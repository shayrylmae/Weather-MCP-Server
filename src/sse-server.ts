/**
 * SSE Transport Server for Weather MCP with Proper Message Routing
 *
 * This implements a connection registry that routes POST /message requests
 * to the correct SSE transport instance based on session ID.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";
import { z } from "zod";

// ============================================
// WEATHER CODE MAPPING
// ============================================
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

// ============================================
// TOOL INPUT SCHEMAS
// ============================================
const GetCurrentWeatherArgsSchema = z.object({
  city: z.string(),
  country: z.string().optional(),
});

const GetWeatherForecastArgsSchema = z.object({
  city: z.string(),
  country: z.string().optional(),
  days: z.number().min(1).max(16).default(7),
});

const GetWeatherAlertsArgsSchema = z.object({
  city: z.string(),
  country: z.string().optional(),
});

const GetGrowingConditionsArgsSchema = z.object({
  city: z.string(),
  country: z.string().optional(),
  base_temp: z.number().default(10),
});

const GetHistoricalWeatherArgsSchema = z.object({
  city: z.string(),
  country: z.string().optional(),
  month: z.number().min(1).max(12),
  years_back: z.number().min(1).max(10).default(1),
});

// ============================================
// HELPER FUNCTIONS
// ============================================
async function geocodeCity(city: string, country?: string) {
  const searchQuery = country ? `${city}, ${country}` : city;
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&language=en&format=json`;

  const response = await fetch(geoUrl);
  if (!response.ok) throw new Error(`Geocoding error: ${response.statusText}`);

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`City not found: "${city}"`);
  }

  const result = data.results[0];
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: result.name,
    country: result.country_code || result.country,
    timezone: result.timezone,
  };
}

async function fetchCurrentWeather(city: string, country?: string) {
  const location = await geocodeCity(city, country);
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=${location.timezone}`;

  const response = await fetch(weatherUrl);
  if (!response.ok) throw new Error(`Weather API error: ${response.statusText}`);

  const data = await response.json();
  return {
    location: `${location.name}, ${location.country}`,
    timezone: location.timezone,
    current: {
      temperature: `${data.current.temperature_2m}°C`,
      feels_like: `${data.current.apparent_temperature}°C`,
      humidity: `${data.current.relative_humidity_2m}%`,
      precipitation: `${data.current.precipitation} mm`,
      weather: WEATHER_CODES[data.current.weather_code] || "Unknown",
      wind_speed: `${data.current.wind_speed_10m} km/h`,
      wind_direction: `${data.current.wind_direction_10m}°`,
    },
    time: data.current.time,
  };
}

async function fetchWeatherForecast(city: string, country?: string, days: number = 7) {
  const location = await geocodeCity(city, country);
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=${location.timezone}&forecast_days=${days}`;

  const response = await fetch(weatherUrl);
  if (!response.ok) throw new Error(`Weather API error: ${response.statusText}`);

  const data = await response.json();
  const forecast = data.daily.time.map((date: string, index: number) => ({
    date,
    weather: WEATHER_CODES[data.daily.weather_code[index]] || "Unknown",
    temperature_max: `${data.daily.temperature_2m_max[index]}°C`,
    temperature_min: `${data.daily.temperature_2m_min[index]}°C`,
    precipitation: `${data.daily.precipitation_sum[index]} mm`,
    wind_speed_max: `${data.daily.wind_speed_10m_max[index]} km/h`,
  }));

  return {
    location: `${location.name}, ${location.country}`,
    timezone: location.timezone,
    forecast_days: days,
    forecast,
  };
}

async function fetchWeatherAlerts(city: string, country?: string) {
  const location = await geocodeCity(city, country);
  const currentWeather = await fetchCurrentWeather(city, country);

  const alerts: string[] = [];
  const temp = parseFloat(currentWeather.current.temperature.replace("°C", ""));
  const windSpeed = parseFloat(currentWeather.current.wind_speed.replace(" km/h", ""));
  const precipitation = parseFloat(currentWeather.current.precipitation.replace(" mm", ""));

  if (temp > 35) alerts.push("⚠️ Extreme Heat Warning: Temperature exceeds 35°C");
  else if (temp < -10) alerts.push("⚠️ Extreme Cold Warning: Temperature below -10°C");
  if (windSpeed > 50) alerts.push("⚠️ High Wind Warning: Wind speeds exceed 50 km/h");
  if (precipitation > 20) alerts.push("⚠️ Heavy Precipitation Warning: Significant rainfall detected");
  if (currentWeather.current.weather.toLowerCase().includes("thunderstorm")) {
    alerts.push("⚠️ Thunderstorm Warning: Severe weather conditions");
  }

  return {
    location: `${location.name}, ${location.country}`,
    checked_at: new Date().toISOString(),
    current_conditions: currentWeather.current,
    alerts: alerts.length > 0 ? alerts : ["✓ No weather alerts at this time"],
  };
}

async function fetchGrowingConditions(city: string, country?: string, baseTemp: number = 10) {
  const location = await geocodeCity(city, country);
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,soil_temperature_0_to_7cm,soil_moisture_0_to_7cm&hourly=temperature_2m,shortwave_radiation&timezone=${location.timezone}&forecast_days=1`;

  const response = await fetch(weatherUrl);
  if (!response.ok) throw new Error(`Weather API error: ${response.statusText}`);

  const data = await response.json();
  const hourlyTemps = data.hourly.temperature_2m.slice(0, 24);
  const avgTemp = hourlyTemps.reduce((sum: number, temp: number) => sum + temp, 0) / hourlyTemps.length;
  const gdd = Math.max(0, avgTemp - baseTemp);

  const solarRadiation = data.hourly.shortwave_radiation.slice(0, 24);
  const avgRadiation = solarRadiation.reduce((sum: number, val: number) => sum + val, 0) / solarRadiation.length;

  return {
    location: `${location.name}, ${location.country}`,
    timezone: location.timezone,
    current_conditions: {
      air_temperature: `${data.current.temperature_2m}°C`,
      relative_humidity: `${data.current.relative_humidity_2m}%`,
      soil_temperature: `${data.current.soil_temperature_0_to_7cm}°C`,
      soil_moisture: `${data.current.soil_moisture_0_to_7cm} m³/m³`,
    },
    growing_metrics: {
      growing_degree_days: `${gdd.toFixed(2)} GDD (base ${baseTemp}°C)`,
      avg_solar_radiation: `${avgRadiation.toFixed(2)} W/m²`,
      description: gdd > 0 ? "Conditions favorable for plant growth" : "Temperature below growing threshold",
    },
    measured_at: data.current.time,
  };
}

async function fetchHistoricalWeather(city: string, month: number, country?: string, yearsBack: number = 1) {
  const location = await geocodeCity(city, country);
  const currentYear = new Date().getFullYear();
  const monthName = new Date(2000, month - 1).toLocaleString('en', { month: 'long' });

  const historicalData = [];

  for (let i = 0; i < yearsBack; i++) {
    const year = currentYear - 1 - i;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=${location.timezone}`;

    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error(`Historical Weather API error: ${response.statusText}`);

    const data = await response.json();
    const temps = data.daily.temperature_2m_mean;
    const maxTemps = data.daily.temperature_2m_max;
    const minTemps = data.daily.temperature_2m_min;
    const precipitation = data.daily.precipitation_sum;
    const windSpeeds = data.daily.wind_speed_10m_max;

    const avgTemp = temps.reduce((sum: number, t: number) => sum + t, 0) / temps.length;
    const maxTempOfMonth = Math.max(...maxTemps);
    const minTempOfMonth = Math.min(...minTemps);
    const totalPrecipitation = precipitation.reduce((sum: number, p: number) => sum + p, 0);
    const avgWindSpeed = windSpeeds.reduce((sum: number, w: number) => sum + w, 0) / windSpeeds.length;

    historicalData.push({
      year,
      month: monthName,
      statistics: {
        avg_temperature: `${avgTemp.toFixed(1)}°C`,
        max_temperature: `${maxTempOfMonth.toFixed(1)}°C`,
        min_temperature: `${minTempOfMonth.toFixed(1)}°C`,
        total_precipitation: `${totalPrecipitation.toFixed(1)} mm`,
        avg_wind_speed: `${avgWindSpeed.toFixed(1)} km/h`,
      },
      days_in_month: temps.length,
    });
  }

  return {
    location: `${location.name}, ${location.country}`,
    timezone: location.timezone,
    month: monthName,
    years_retrieved: yearsBack,
    historical_data: historicalData,
  };
}

// ============================================
// CONNECTION REGISTRY
// ============================================
interface SSEConnection {
  sessionId: string;
  transport: SSEServerTransport;
  server: Server;
  createdAt: Date;
  lastActivity: Date;
}

class ConnectionRegistry {
  private connections = new Map<string, SSEConnection>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up stale connections every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupStaleConnections(), 5 * 60 * 1000);
  }

  register(sessionId: string, transport: SSEServerTransport, server: Server): void {
    const now = new Date();
    this.connections.set(sessionId, {
      sessionId,
      transport,
      server,
      createdAt: now,
      lastActivity: now,
    });
    console.error(`[Registry] Registered session ${sessionId} (total: ${this.connections.size})`);
  }

  get(sessionId: string): SSEConnection | undefined {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.lastActivity = new Date();
    }
    return connection;
  }

  remove(sessionId: string): void {
    if (this.connections.delete(sessionId)) {
      console.error(`[Registry] Removed session ${sessionId} (remaining: ${this.connections.size})`);
    }
  }

  private cleanupStaleConnections(): void {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, connection] of this.connections.entries()) {
      const inactive = now.getTime() - connection.lastActivity.getTime();
      if (inactive > timeout) {
        console.error(`[Registry] Cleaning up stale session ${sessionId} (inactive for ${Math.round(inactive / 60000)}min)`);
        this.remove(sessionId);
      }
    }
  }

  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.connections.clear();
  }

  size(): number {
    return this.connections.size;
  }
}

// ============================================
// MCP SERVER FACTORY
// ============================================
function createMCPServer(): Server {
  const server = new Server(
    {
      name: "weather-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_current_weather",
          description: "Get real-time current weather conditions for any city worldwide",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string", description: "City name" },
              country: { type: "string", description: "Optional country code" },
            },
            required: ["city"],
          },
        },
        {
          name: "get_weather_forecast",
          description: "Get weather forecast for up to 16 days",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string", description: "City name" },
              country: { type: "string", description: "Optional country code" },
              days: { type: "number", description: "Number of forecast days (1-16)", minimum: 1, maximum: 16 },
            },
            required: ["city"],
          },
        },
        {
          name: "get_weather_alerts",
          description: "Check for weather warnings and alerts",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string", description: "City name" },
              country: { type: "string", description: "Optional country code" },
            },
            required: ["city"],
          },
        },
        {
          name: "get_growing_conditions",
          description: "Get growing conditions including GDD, solar radiation, and soil metrics",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string", description: "City name" },
              country: { type: "string", description: "Optional country code" },
              base_temp: { type: "number", description: "Base temperature for GDD (default: 10°C)" },
            },
            required: ["city"],
          },
        },
        {
          name: "get_historical_weather",
          description: "Retrieve historical weather data for a specific month",
          inputSchema: {
            type: "object",
            properties: {
              city: { type: "string", description: "City name" },
              country: { type: "string", description: "Optional country code" },
              month: { type: "number", description: "Month (1-12)", minimum: 1, maximum: 12 },
              years_back: { type: "number", description: "Years back (1-10)", minimum: 1, maximum: 10 },
            },
            required: ["city", "month"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (request.params.name === "get_current_weather") {
        const args = GetCurrentWeatherArgsSchema.parse(request.params.arguments);
        const data = await fetchCurrentWeather(args.city, args.country);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      if (request.params.name === "get_weather_forecast") {
        const args = GetWeatherForecastArgsSchema.parse(request.params.arguments);
        const data = await fetchWeatherForecast(args.city, args.country, args.days);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      if (request.params.name === "get_weather_alerts") {
        const args = GetWeatherAlertsArgsSchema.parse(request.params.arguments);
        const data = await fetchWeatherAlerts(args.city, args.country);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      if (request.params.name === "get_growing_conditions") {
        const args = GetGrowingConditionsArgsSchema.parse(request.params.arguments);
        const data = await fetchGrowingConditions(args.city, args.country, args.base_temp);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      if (request.params.name === "get_historical_weather") {
        const args = GetHistoricalWeatherArgsSchema.parse(request.params.arguments);
        const data = await fetchHistoricalWeather(args.city, args.month, args.country, args.years_back);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      throw new Error(`Unknown tool: ${request.params.name}`);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ============================================
// HTTP SERVER WITH MESSAGE ROUTING
// ============================================
const PORT = parseInt(process.env.PORT || '3003', 10);
const registry = new ConnectionRegistry();

// Helper to read POST body
async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => body += chunk.toString());
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      transport: 'SSE',
      connections: registry.size(),
    }));
    return;
  }

  // Root endpoint
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Weather MCP Server (SSE with Routing)',
      version: '1.0.0',
      transport: 'Server-Sent Events',
      endpoints: {
        health: 'GET /health',
        sse: 'GET /sse',
        message: 'POST /message (requires X-Session-ID header)',
      },
      active_connections: registry.size(),
    }));
    return;
  }

  // SSE endpoint - establishes persistent connection
  if (req.url === '/sse') {
    const sessionId = randomUUID();
    console.error(`[SSE] New connection request, session: ${sessionId}`);

    // Create MCP server instance for this connection
    const server = createMCPServer();

    // Create SSE transport
    const transport = new SSEServerTransport(`/message?session=${sessionId}`, res);

    // Register the connection
    registry.register(sessionId, transport, server);

    // Connect the server to the transport
    await server.connect(transport);

    console.error(`[SSE] Server connected for session ${sessionId}`);

    // Clean up when connection closes
    res.on('close', () => {
      console.error(`[SSE] Connection closed for session ${sessionId}`);
      registry.remove(sessionId);
    });

    return;
  }

  // Message endpoint - routes messages to the correct transport
  if (req.method === 'POST' && req.url?.startsWith('/message')) {
    try {
      // Extract session ID from query parameter
      const url = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = url.searchParams.get('session');

      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing session parameter' }));
        return;
      }

      // Find the connection
      const connection = registry.get(sessionId);
      if (!connection) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found or expired' }));
        return;
      }

      // Read and parse the message body
      const body = await readBody(req);
      const parsedBody = JSON.parse(body);

      console.error(`[Message] Routing JSON-RPC message to session ${sessionId}`);

      // Forward the message to the transport using handlePostMessage
      await connection.transport.handlePostMessage(req, res, parsedBody);

    } catch (error) {
      console.error('[Message] Error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
    return;
  }

  // 404 for all other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.error(`\n✅ Weather MCP Server (SSE with Routing) running on http://0.0.0.0:${PORT}`);
  console.error(`\n📡 Transport: Server-Sent Events with message routing`);
  console.error(`   - Persistent stateful connections`);
  console.error(`   - Session-based message routing`);
  console.error(`   - Automatic connection cleanup`);
  console.error(`\n📚 Endpoints:`);
  console.error(`   GET  /           - Server info`);
  console.error(`   GET  /health     - Health check`);
  console.error(`   GET  /sse        - Establish SSE connection (returns session ID)`);
  console.error(`   POST /message    - Send MCP messages (requires session parameter)`);
  console.error(`\n🛠️  Available Tools:`);
  console.error(`   1. get_current_weather     - Real-time weather`);
  console.error(`   2. get_weather_forecast    - Multi-day forecast`);
  console.error(`   3. get_weather_alerts      - Weather alerts`);
  console.error(`   4. get_growing_conditions  - Growing metrics`);
  console.error(`   5. get_historical_weather  - Historical data`);
  console.error(``);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('\n\nShutting down...');
  registry.shutdown();
  httpServer.close();
  process.exit(0);
});
