/**
 * SSE Transport Server for Weather MCP - Fixed Version
 *
 * This implements the correct SSE server pattern for MCP SDK
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { z } from "zod";

// Import all the weather functions and schemas from index.ts
// For now, I'll inline the essentials

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

// Create the MCP server
function createMCPServer() {
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
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (request.params.name === "get_current_weather") {
        const args = GetCurrentWeatherArgsSchema.parse(request.params.arguments);
        const weatherData = await fetchCurrentWeather(args.city, args.country);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(weatherData, null, 2),
            },
          ],
        };
      }
      throw new Error(`Unknown tool: ${request.params.name}`);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

const PORT = process.env.PORT || 3003;

// Create HTTP server
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', transport: 'SSE' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Weather MCP Server (SSE)',
      version: '1.0.0',
      endpoints: {
        health: 'GET /health',
        sse: 'GET /sse',
      }
    }));
    return;
  }

  // SSE endpoint
  if (req.url === '/sse') {
    console.error('[SSE] New connection');

    // Create a new MCP server instance for this connection
    const server = createMCPServer();

    // Create SSE transport and connect
    const transport = new SSEServerTransport('/message', res);
    await server.connect(transport);

    console.error('[SSE] Server connected');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, () => {
  console.error(`✅ Weather MCP Server (SSE) on http://localhost:${PORT}`);
  console.error(`📡 GET /sse - SSE endpoint`);
  console.error(`📡 GET /health - Health check`);
});

process.on('SIGINT', () => {
  console.error('\nShutting down...');
  httpServer.close();
  process.exit(0);
});
