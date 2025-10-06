/**
 * HTTP Proxy for Weather MCP Server
 * Wraps the stdio MCP server with an HTTP interface
 */

import { spawn } from 'child_process';
import { createServer } from 'http';

const PORT = 3002;

// Start the MCP server as a child process
console.log('Starting MCP server...');
const mcpServer = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let messageId = 1;
const pendingRequests = new Map();
let serverReady = false;
const readyCallbacks = [];

// Handle stderr (server logs)
mcpServer.stderr.on('data', (data) => {
  const message = data.toString();
  console.error('[MCP Server]', message.trim());

  // Server is ready when it logs "running on stdio"
  if (message.includes('running on stdio') || message.includes('Available tools')) {
    serverReady = true;
    readyCallbacks.forEach(cb => cb());
    readyCallbacks.length = 0;
  }
});

// Handle responses from MCP server
mcpServer.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const response = JSON.parse(line);

      if (response.id && pendingRequests.has(response.id)) {
        const { resolve } = pendingRequests.get(response.id);
        resolve(response);
        pendingRequests.delete(response.id);
      }
    } catch (error) {
      // Ignore non-JSON output
    }
  }
});

mcpServer.on('error', (error) => {
  console.error('[MCP Server] Process error:', error);
});

mcpServer.on('exit', (code, signal) => {
  console.error(`[MCP Server] Process exited with code ${code}, signal ${signal}`);
});

// Wait for server to be ready
function waitForReady() {
  return new Promise((resolve) => {
    if (serverReady) {
      resolve();
    } else {
      readyCallbacks.push(resolve);
    }
  });
}

// Function to call MCP tool
async function callMCPTool(toolName, args, timeout = 30000) {
  await waitForReady();

  return new Promise((resolve, reject) => {
    const id = messageId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    // Store pending request with timeout cleanup
    let timeoutId;
    pendingRequests.set(id, {
      resolve: (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      },
      reject
    });

    // Set timeout
    timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }
    }, timeout);

    // Send request to MCP server
    try {
      mcpServer.stdin.write(JSON.stringify(request) + '\n');
    } catch (error) {
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      reject(error);
    }
  });
}

// Parse URL query parameters
function parseQuery(url) {
  const params = {};
  const queryString = url.split('?')[1];
  if (queryString) {
    queryString.split('&').forEach(param => {
      const [key, value] = param.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    });
  }
  return params;
}

// Create HTTP server
const httpServer = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // Root endpoint - API documentation
  if (req.method === 'GET' && urlPath === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Weather MCP HTTP Proxy',
      version: '1.0.0',
      endpoints: {
        health: 'GET /health',
        current: 'GET /weather/current?city=<city>&country=<code>',
        forecast: 'GET /weather/forecast?city=<city>&days=<1-16>&country=<code>',
        alerts: 'GET /weather/alerts?city=<city>&country=<code>',
        growing: 'GET /weather/growing?city=<city>&baseTemp=<°C>&country=<code>',
        historical: 'GET /weather/historical?city=<city>&month=<1-12>&yearsBack=<1-10>&country=<code>',
        generic: 'POST /call-tool (body: {name, arguments})'
      },
      examples: {
        current: '/weather/current?city=Manila&country=PH',
        forecast: '/weather/forecast?city=Manila&days=7',
        growing: '/weather/growing?city=Manila&baseTemp=10'
      }
    }, null, 2));
    return;
  }

  // REST API Endpoints for Weather Tools

  // GET /weather/current
  if (req.method === 'GET' && urlPath === '/weather/current') {
    const params = parseQuery(req.url);
    if (!params.city) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameter: city' }));
      return;
    }

    try {
      const args = { city: params.city };
      if (params.country) args.country = params.country;

      console.log(`[HTTP Proxy] Getting current weather for ${params.city}`);
      const response = await callMCPTool('get_current_weather', args);

      // Check if MCP server returned an error
      if (response.result?.isError) {
        const errorText = response.result?.content?.[0]?.text || 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorText }));
        return;
      }

      // Extract the text content from MCP response
      const data = response.result?.content?.[0]?.text
        ? JSON.parse(response.result.content[0].text)
        : response.result;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[HTTP Proxy] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // GET /weather/forecast
  if (req.method === 'GET' && urlPath === '/weather/forecast') {
    const params = parseQuery(req.url);
    if (!params.city) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameter: city' }));
      return;
    }

    try {
      const args = { city: params.city };
      if (params.country) args.country = params.country;
      if (params.days) args.days = parseInt(params.days);

      console.log(`[HTTP Proxy] Getting forecast for ${params.city}`);
      const response = await callMCPTool('get_weather_forecast', args);

      // Check if MCP server returned an error
      if (response.result?.isError) {
        const errorText = response.result?.content?.[0]?.text || 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorText }));
        return;
      }

      const data = response.result?.content?.[0]?.text
        ? JSON.parse(response.result.content[0].text)
        : response.result;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[HTTP Proxy] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // GET /weather/alerts
  if (req.method === 'GET' && urlPath === '/weather/alerts') {
    const params = parseQuery(req.url);
    if (!params.city) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameter: city' }));
      return;
    }

    try {
      const args = { city: params.city };
      if (params.country) args.country = params.country;

      console.log(`[HTTP Proxy] Getting alerts for ${params.city}`);
      const response = await callMCPTool('get_weather_alerts', args);

      // Check if MCP server returned an error
      if (response.result?.isError) {
        const errorText = response.result?.content?.[0]?.text || 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorText }));
        return;
      }

      const data = response.result?.content?.[0]?.text
        ? JSON.parse(response.result.content[0].text)
        : response.result;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[HTTP Proxy] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // GET /weather/growing
  if (req.method === 'GET' && urlPath === '/weather/growing') {
    const params = parseQuery(req.url);
    if (!params.city) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameter: city' }));
      return;
    }

    try {
      const args = { city: params.city };
      if (params.country) args.country = params.country;
      if (params.baseTemp) args.base_temp = parseFloat(params.baseTemp);

      console.log(`[HTTP Proxy] Getting growing conditions for ${params.city}`);
      const response = await callMCPTool('get_growing_conditions', args);

      // Check if MCP server returned an error
      if (response.result?.isError) {
        const errorText = response.result?.content?.[0]?.text || 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorText }));
        return;
      }

      const data = response.result?.content?.[0]?.text
        ? JSON.parse(response.result.content[0].text)
        : response.result;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[HTTP Proxy] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // GET /weather/historical
  if (req.method === 'GET' && urlPath === '/weather/historical') {
    const params = parseQuery(req.url);
    if (!params.city || !params.month) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameters: city, month' }));
      return;
    }

    try {
      const args = {
        city: params.city,
        month: parseInt(params.month)
      };
      if (params.country) args.country = params.country;
      if (params.yearsBack) args.years_back = parseInt(params.yearsBack);

      console.log(`[HTTP Proxy] Getting historical weather for ${params.city}`);
      const response = await callMCPTool('get_historical_weather', args);

      // Check if MCP server returned an error
      if (response.result?.isError) {
        const errorText = response.result?.content?.[0]?.text || 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorText }));
        return;
      }

      const data = response.result?.content?.[0]?.text
        ? JSON.parse(response.result.content[0].text)
        : response.result;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[HTTP Proxy] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Generic POST /call-tool endpoint
  if (req.method === 'POST' && urlPath === '/call-tool') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { name, arguments: args } = JSON.parse(body);

        console.log(`[HTTP Proxy] Calling MCP tool: ${name}`, args);

        const response = await callMCPTool(name, args);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));

      } catch (error) {
        console.error('[HTTP Proxy] Error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code: -32603,
            message: error.message
          }
        }));
      }
    });

    return;
  }

  // Health check endpoint
  if (req.method === 'GET' && urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', mcp_server: 'running' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', url: req.url }));
});

httpServer.listen(PORT, () => {
  console.log(`\n✅ Weather MCP HTTP Proxy running on http://localhost:${PORT}`);
  console.log(`   Waiting for MCP server to initialize...`);

  // Don't block - let server accept connections immediately
  // The waitForReady() in callMCPTool() will handle waiting per-request
  waitForReady().then(() => {
    console.log(`\n✅ MCP Server ready!`);
    console.log(`\n📚 Available REST Endpoints:`);
    console.log(`   GET  /                        - API documentation`);
    console.log(`   GET  /health                  - Health check`);
    console.log(`   GET  /weather/current         - Current weather`);
    console.log(`   GET  /weather/forecast        - Weather forecast (1-16 days)`);
    console.log(`   GET  /weather/alerts          - Weather alerts & warnings`);
    console.log(`   GET  /weather/growing         - Growing conditions (GDD, soil)`);
    console.log(`   GET  /weather/historical      - Historical weather data`);
    console.log(`   POST /call-tool               - Generic MCP tool call`);
    console.log(`\n🌾 Example for Agriculture App:`);
    console.log(`   http://localhost:${PORT}/weather/current?city=Manila&country=PH`);
    console.log(`   http://localhost:${PORT}/weather/growing?city=Manila&baseTemp=10\n`);
  });
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  mcpServer.kill();
  process.exit(0);
});
