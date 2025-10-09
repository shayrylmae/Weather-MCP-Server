/**
 * SSE Transport Server for Weather MCP
 *
 * This implementation uses Server-Sent Events (SSE) for a persistent,
 * stateful connection instead of request-response cycles per tool call.
 *
 * Benefits over HTTP proxy:
 * - Persistent connection maintains state across tool calls
 * - Native MCP protocol support over HTTP
 * - Better efficiency for streaming AI interactions
 * - Standards-compliant SSE implementation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { z } from "zod";

// ============================================
// WEATHER CODE MAPPING (Open-Meteo WMO codes)
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
  city: z.string().describe("City name (e.g., 'London', 'New York')"),
  country: z.string().optional().describe("Country code (optional, e.g., 'US', 'GB')"),
});

const GetWeatherForecastArgsSchema = z.object({
  city: z.string().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  days: z.number().min(1).max(16).default(7).describe("Number of forecast days (1-16, default: 7)"),
});

const GetWeatherAlertsArgsSchema = z.object({
  city: z.string().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
});

const GetGrowingConditionsArgsSchema = z.object({
  city: z.string().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  base_temp: z.number().default(10).describe("Base temperature for growing degree days in °C (default: 10°C)"),
});

const GetHistoricalWeatherArgsSchema = z.object({
  city: z.string().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  month: z.number().min(1).max(12).describe("Month (1-12)"),
  years_back: z.number().min(1).max(10).default(1).describe("Number of years back to retrieve data (1-10, default: 1 for past year)"),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function geocodeCity(
  city: string,
  country?: string,
  maxRetries: number = 3,
  timeoutMs: number = 10000
): Promise<{
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  timezone: string;
}> {
  const searchQuery = country ? `${city}, ${country}` : city;
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    searchQuery
  )}&count=1&language=en&format=json`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(geoUrl, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error(
            `Geocoding API server error (${response.status}): ${response.statusText}. The service may be temporarily down.`
          );
        } else if (response.status === 429) {
          throw new Error('Geocoding API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(
            `Geocoding API error (${response.status}): ${response.statusText}`
          );
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(
          `Geocoding API returned invalid JSON response. The service may be experiencing issues.`
        );
      }

      if (!data.results || data.results.length === 0) {
        throw new Error(
          `City not found: "${city}"${country ? ` in ${country}` : ''}. Please check the spelling and try again.`
        );
      }

      const result = data.results[0];

      if (
        !result.latitude ||
        !result.longitude ||
        !result.name ||
        !result.timezone
      ) {
        throw new Error(
          'Geocoding API returned incomplete data. The service may be experiencing issues.'
        );
      }

      return {
        latitude: result.latitude,
        longitude: result.longitude,
        name: result.name,
        country: result.country_code || result.country,
        timezone: result.timezone,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (
        lastError.message.includes('City not found') ||
        lastError.message.includes('rate limit')
      ) {
        throw lastError;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error(
          `Geocoding API request timed out after ${timeoutMs}ms. The service may be slow or down.`
        );
      }

      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Geocoding failed after all retry attempts');
}

async function fetchCurrentWeather(city: string, country?: string) {
  const location = await geocodeCity(city, country);

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=${location.timezone}`;

  const response = await fetch(weatherUrl);

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.statusText}`);
  }

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

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.statusText}`);
  }

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

  if (temp > 35) {
    alerts.push("⚠️ Extreme Heat Warning: Temperature exceeds 35°C");
  } else if (temp < -10) {
    alerts.push("⚠️ Extreme Cold Warning: Temperature below -10°C");
  }

  if (windSpeed > 50) {
    alerts.push("⚠️ High Wind Warning: Wind speeds exceed 50 km/h");
  }

  if (precipitation > 20) {
    alerts.push("⚠️ Heavy Precipitation Warning: Significant rainfall detected");
  }

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

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.statusText}`);
  }

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

    if (!response.ok) {
      throw new Error(`Historical Weather API error: ${response.statusText}`);
    }

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
// MCP SERVER SETUP WITH SSE TRANSPORT
// ============================================

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

// Register MCP tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_current_weather",
        description:
          "Get real-time current weather conditions for any city worldwide. Returns temperature, feels-like temperature, humidity, precipitation, weather description, and wind information.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name (e.g., 'London', 'Tokyo', 'New York')",
            },
            country: {
              type: "string",
              description: "Optional country code for disambiguation (e.g., 'US', 'GB', 'JP')",
            },
          },
          required: ["city"],
        },
      },
      {
        name: "get_weather_forecast",
        description:
          "Get weather forecast for up to 16 days. Returns daily predictions including max/min temperatures, precipitation, weather conditions, and wind speeds. Perfect for planning trips or events.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
            days: {
              type: "number",
              description: "Number of forecast days (1-16, default: 7)",
              minimum: 1,
              maximum: 16,
            },
          },
          required: ["city"],
        },
      },
      {
        name: "get_weather_alerts",
        description:
          "Check for weather warnings and alerts based on current conditions. Detects extreme temperatures, high winds, heavy precipitation, and severe weather like thunderstorms.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
          },
          required: ["city"],
        },
      },
      {
        name: "get_growing_conditions",
        description:
          "Get current growing conditions including Growing Degree Days (GDD), solar radiation, humidity, and soil metrics. Used to predict crop development stages and optimize growing conditions.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
            base_temp: {
              type: "number",
              description: "Base temperature for GDD calculation in °C (default: 10°C, common for many crops)",
            },
          },
          required: ["city"],
        },
      },
      {
        name: "get_historical_weather",
        description:
          "Retrieve historical weather data for a specific month over multiple years. Returns monthly statistics including average, max, and min temperatures, total precipitation, and average wind speed. Default retrieves data for the past year, up to 10 years available.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
            month: {
              type: "number",
              description: "Month number (1-12, where 1=January, 12=December)",
              minimum: 1,
              maximum: 12,
            },
            years_back: {
              type: "number",
              description: "Number of years back to retrieve (1-10, default: 1)",
              minimum: 1,
              maximum: 10,
            },
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
      const weatherData = await fetchCurrentWeather(args.city, args.country);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(weatherData, null, 2),
          },
        ],
      };
    } else if (request.params.name === "get_weather_forecast") {
      const args = GetWeatherForecastArgsSchema.parse(request.params.arguments);
      const forecastData = await fetchWeatherForecast(args.city, args.country, args.days);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(forecastData, null, 2),
          },
        ],
      };
    } else if (request.params.name === "get_weather_alerts") {
      const args = GetWeatherAlertsArgsSchema.parse(request.params.arguments);
      const alertsData = await fetchWeatherAlerts(args.city, args.country);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(alertsData, null, 2),
          },
        ],
      };
    } else if (request.params.name === "get_growing_conditions") {
      const args = GetGrowingConditionsArgsSchema.parse(request.params.arguments);
      const growingData = await fetchGrowingConditions(args.city, args.country, args.base_temp);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(growingData, null, 2),
          },
        ],
      };
    } else if (request.params.name === "get_historical_weather") {
      const args = GetHistoricalWeatherArgsSchema.parse(request.params.arguments);
      const historicalData = await fetchHistoricalWeather(args.city, args.month, args.country, args.years_back);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(historicalData, null, 2),
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
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

// ============================================
// HTTP SERVER WITH SSE TRANSPORT
// ============================================

const PORT = process.env.PORT || 3003;

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      transport: 'SSE',
      version: '1.0.0',
      mcp_sdk_version: '1.18.2'
    }));
    return;
  }

  // Root endpoint - API documentation
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Weather MCP Server with SSE Transport',
      version: '1.0.0',
      transport: 'Server-Sent Events (SSE)',
      description: 'Persistent MCP connection over HTTP using SSE for stateful interactions',
      endpoints: {
        health: 'GET /health',
        sse: 'GET /sse (MCP over SSE endpoint)',
        message: 'POST /message (MCP JSON-RPC messages)',
      },
      benefits: [
        'Persistent connection maintains state across tool calls',
        'Native MCP protocol support over HTTP',
        'Better efficiency for streaming AI interactions',
        'Standards-compliant SSE implementation'
      ],
      tools: [
        'get_current_weather',
        'get_weather_forecast',
        'get_weather_alerts',
        'get_growing_conditions',
        'get_historical_weather'
      ]
    }, null, 2));
    return;
  }

  // SSE endpoint - establishes persistent connection
  if (req.method === 'GET' && req.url === '/sse') {
    console.error('[SSE Server] New SSE connection established');

    const transport = new SSEServerTransport('/message', res);
    await server.connect(transport);

    // Connection will be kept alive by SSE transport
    return;
  }

  // Message endpoint - receives MCP messages
  if (req.method === 'POST' && req.url === '/message') {
    // SSE transport handles this endpoint automatically
    // This is just for documentation purposes
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'This endpoint is handled by SSE transport. Connect via /sse first.'
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, () => {
  console.error(`\n✅ Weather MCP Server (SSE Transport) running on http://localhost:${PORT}`);
  console.error(`\n📡 Transport: Server-Sent Events (SSE)`);
  console.error(`   - Persistent stateful connection`);
  console.error(`   - Native MCP protocol over HTTP`);
  console.error(`   - Efficient streaming for AI interactions`);
  console.error(`\n📚 Endpoints:`);
  console.error(`   GET  /           - API documentation`);
  console.error(`   GET  /health     - Health check`);
  console.error(`   GET  /sse        - SSE connection endpoint`);
  console.error(`   POST /message    - MCP message endpoint`);
  console.error(`\n🛠️  Available Tools:`);
  console.error(`   1. get_current_weather     - Real-time weather conditions`);
  console.error(`   2. get_weather_forecast    - Multi-day forecast (up to 16 days)`);
  console.error(`   3. get_weather_alerts      - Weather warnings and alerts`);
  console.error(`   4. get_growing_conditions  - GDD, solar radiation, soil metrics`);
  console.error(`   5. get_historical_weather  - Historical data (up to 10 years)`);
  console.error(``);
});

// Handle process termination
process.on('SIGINT', () => {
  console.error('\n\nShutting down SSE server...');
  httpServer.close();
  process.exit(0);
});
