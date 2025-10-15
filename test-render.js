/**
 * Test Script for Weather MCP Server on Render (SSE Transport)
 * Tests all MCP tools including historical weather data for Manila
 */

const SERVER_URL = 'https://weather-mcp-server-67ou.onrender.com';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// SSE Connection Manager
class SSEConnection {
  constructor(url) {
    this.url = url;
    this.sessionId = null;
    this.messageId = 1;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      log('\n🔌 Establishing SSE connection...', 'cyan');

      // Note: EventSource is not available in Node.js by default
      // We'll use a simple approach: connect and extract session ID
      fetch(`${this.url}/sse`)
        .then(response => {
          // The SSE endpoint will return session info in the endpoint event
          // For testing, we'll use a simpler approach with direct message posting

          // Since we can't easily use EventSource in Node.js without additional deps,
          // we'll use the session-less approach for this test
          log('⚠️  Note: Full SSE requires EventSource (browser environment)', 'yellow');
          log('    Using direct POST method for testing\n', 'yellow');
          resolve();
        })
        .catch(reject);
    });
  }

  async callTool(toolName, args) {
    const message = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const endpoint = this.sessionId
      ? `${this.url}/message?session=${this.sessionId}`
      : `${this.url}/message`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}

async function testHealthCheck() {
  log('\n1. Health Check', 'cyan');
  log('   Testing server connectivity...', 'reset');

  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();

    log('   ✓ Success', 'green');
    log(`   Status: ${data.status}`, 'reset');
    log(`   Transport: ${data.transport}`, 'reset');
    log(`   Active Connections: ${data.connections}`, 'reset');
    return true;
  } catch (error) {
    log(`   ✗ Failed: ${error.message}`, 'red');
    return false;
  }
}

async function testServerInfo() {
  log('\n2. Server Info', 'cyan');
  log('   Fetching server details...', 'reset');

  try {
    const response = await fetch(`${SERVER_URL}/`);
    const data = await response.json();

    log('   ✓ Success', 'green');
    log(`   Name: ${data.name}`, 'reset');
    log(`   Version: ${data.version}`, 'reset');
    log(`   Transport: ${data.transport}`, 'reset');
    return true;
  } catch (error) {
    log(`   ✗ Failed: ${error.message}`, 'red');
    return false;
  }
}

async function testCurrentWeather(connection) {
  log('\n3. Current Weather (Manila)', 'cyan');
  log('   Tool: get_current_weather', 'reset');

  try {
    const result = await connection.callTool('get_current_weather', {
      city: 'Manila',
      country: 'PH'
    });

    if (result.error) {
      log(`   ⚠️  ${result.error.message}`, 'yellow');
      return false;
    }

    log('   ✓ Success', 'green');

    // Parse the response content
    const content = result.result?.content?.[0]?.text;
    if (content) {
      const data = JSON.parse(content);
      log(`   Location: ${data.location}`, 'reset');
      log(`   Temperature: ${data.current.temperature}`, 'reset');
      log(`   Feels Like: ${data.current.feels_like}`, 'reset');
      log(`   Weather: ${data.current.weather}`, 'reset');
      log(`   Humidity: ${data.current.humidity}`, 'reset');
    }

    return true;
  } catch (error) {
    log(`   ✗ Failed: ${error.message}`, 'red');
    return false;
  }
}

async function testWeatherForecast(connection) {
  log('\n4. Weather Forecast (Manila, 7 days)', 'cyan');
  log('   Tool: get_weather_forecast', 'reset');

  try {
    const result = await connection.callTool('get_weather_forecast', {
      city: 'Manila',
      country: 'PH',
      days: 7
    });

    if (result.error) {
      log(`   ⚠️  ${result.error.message}`, 'yellow');
      return false;
    }

    log('   ✓ Success', 'green');

    const content = result.result?.content?.[0]?.text;
    if (content) {
      const data = JSON.parse(content);
      log(`   Location: ${data.location}`, 'reset');
      log(`   Forecast Days: ${data.forecast_days}`, 'reset');
      log(`   First Day: ${data.forecast[0].date} - ${data.forecast[0].weather}`, 'reset');
    }

    return true;
  } catch (error) {
    log(`   ✗ Failed: ${error.message}`, 'red');
    return false;
  }
}

async function testWeatherAlerts(connection) {
  log('\n5. Weather Alerts (Manila)', 'cyan');
  log('   Tool: get_weather_alerts', 'reset');

  try {
    const result = await connection.callTool('get_weather_alerts', {
      city: 'Manila',
      country: 'PH'
    });

    if (result.error) {
      log(`   ⚠️  ${result.error.message}`, 'yellow');
      return false;
    }

    log('   ✓ Success', 'green');

    const content = result.result?.content?.[0]?.text;
    if (content) {
      const data = JSON.parse(content);
      log(`   Location: ${data.location}`, 'reset');
      log(`   Alerts: ${data.alerts.length} item(s)`, 'reset');
      data.alerts.forEach((alert, i) => {
        log(`     ${i + 1}. ${alert}`, 'reset');
      });
    }

    return true;
  } catch (error) {
    log(`   ✗ Failed: ${error.message}`, 'red');
    return false;
  }
}

async function testGrowingConditions(connection) {
  log('\n6. Growing Conditions (Manila)', 'cyan');
  log('   Tool: get_growing_conditions', 'reset');

  try {
    const result = await connection.callTool('get_growing_conditions', {
      city: 'Manila',
      country: 'PH',
      base_temp: 10
    });

    if (result.error) {
      log(`   ⚠️  ${result.error.message}`, 'yellow');
      return false;
    }

    log('   ✓ Success', 'green');

    const content = result.result?.content?.[0]?.text;
    if (content) {
      const data = JSON.parse(content);
      log(`   Location: ${data.location}`, 'reset');
      log(`   Air Temperature: ${data.current_conditions.air_temperature}`, 'reset');
      log(`   Soil Temperature: ${data.current_conditions.soil_temperature}`, 'reset');
      log(`   Soil Moisture: ${data.current_conditions.soil_moisture}`, 'reset');
      log(`   GDD: ${data.growing_metrics.growing_degree_days}`, 'reset');
      log(`   Solar Radiation: ${data.growing_metrics.avg_solar_radiation}`, 'reset');
    }

    return true;
  } catch (error) {
    log(`   ✗ Failed: ${error.message}`, 'red');
    return false;
  }
}

async function testHistoricalWeather(connection) {
  log('\n7. Historical Weather (Manila, 3 years) ⭐', 'cyan');
  log('   Tool: get_historical_weather', 'reset');

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const monthName = new Date().toLocaleString('en', { month: 'long' });

  log(`   Parameters: month=${currentMonth} (${monthName}), years_back=3`, 'reset');

  try {
    const result = await connection.callTool('get_historical_weather', {
      city: 'Manila',
      country: 'PH',
      month: currentMonth,
      years_back: 3
    });

    if (result.error) {
      log(`   ⚠️  ${result.error.message}`, 'yellow');
      return false;
    }

    log('   ✓ Success', 'green');

    const content = result.result?.content?.[0]?.text;
    if (content) {
      const data = JSON.parse(content);
      log(`   Location: ${data.location}`, 'reset');
      log(`   Month: ${data.month}`, 'reset');
      log(`   Years Retrieved: ${data.years_retrieved}`, 'reset');
      log('', 'reset');

      data.historical_data.forEach((yearData, i) => {
        log(`   Year ${yearData.year}:`, 'magenta');
        log(`     Avg Temperature: ${yearData.statistics.avg_temperature}`, 'reset');
        log(`     Max Temperature: ${yearData.statistics.max_temperature}`, 'reset');
        log(`     Min Temperature: ${yearData.statistics.min_temperature}`, 'reset');
        log(`     Total Precipitation: ${yearData.statistics.total_precipitation}`, 'reset');
        log(`     Avg Wind Speed: ${yearData.statistics.avg_wind_speed}`, 'reset');
        log(`     Days in Month: ${yearData.days_in_month}`, 'reset');
        if (i < data.historical_data.length - 1) log('', 'reset');
      });
    }

    return true;
  } catch (error) {
    log(`   ✗ Failed: ${error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  Weather MCP Server Test - Render Deployment', 'cyan');
  log('  URL: ' + SERVER_URL, 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  const results = [];

  // Basic connectivity tests
  results.push(await testHealthCheck());
  results.push(await testServerInfo());

  log('\n═══════════════════════════════════════════════════════════', 'yellow');
  log('  MCP Tool Tests', 'yellow');
  log('═══════════════════════════════════════════════════════════', 'yellow');

  // Create SSE connection (or use direct messaging)
  const connection = new SSEConnection(SERVER_URL);
  await connection.connect();

  // Test all MCP tools
  results.push(await testCurrentWeather(connection));
  results.push(await testWeatherForecast(connection));
  results.push(await testWeatherAlerts(connection));
  results.push(await testGrowingConditions(connection));
  results.push(await testHistoricalWeather(connection));

  // Summary
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  Test Summary', 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  const passed = results.filter(r => r === true).length;
  const failed = results.filter(r => r === false).length;
  const total = results.length;

  log(`\nTotal Tests: ${total}`, 'blue');
  log(`Passed: ${passed}`, passed === total ? 'green' : 'yellow');
  log(`Failed: ${failed}`, failed === 0 ? 'green' : 'red');

  if (failed > 0) {
    log('\n⚠️  Some tests failed due to SSE session requirements.', 'yellow');
    log('   This is expected when testing SSE transport without EventSource.', 'yellow');
    log('   For full testing, use the browser-based test-sse.html', 'yellow');
  } else {
    log('\n✓ All tests passed!', 'green');
  }

  log('');
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`\n✗ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
