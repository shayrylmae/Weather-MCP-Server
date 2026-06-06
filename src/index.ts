import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { geocodeCity, fetchWeatherData, WEATHER_CODES } from "./helpers.js";

// Weather codes and geocoding are now imported from helpers.js

// ============================================
// TOOL INPUT SCHEMAS
// ============================================

// Tool 1: Get Current Weather
const GetCurrentWeatherArgsSchema = z.object({
  city: z.string().optional().describe("City name (e.g., 'London', 'New York')"),
  country: z.string().optional().describe("Country code (optional, e.g., 'US', 'GB')"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

// Tool 2: Get Weather Forecast
const GetWeatherForecastArgsSchema = z.object({
  city: z.string().optional().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
  days: z.number().min(1).max(16).default(7).describe("Number of forecast days (1-16, default: 7)"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

// Tool 3: Get Weather Alerts/Warnings
const GetWeatherAlertsArgsSchema = z.object({
  city: z.string().optional().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

// Tool 4: Get Growing Conditions
const GetGrowingConditionsArgsSchema = z.object({
  city: z.string().optional().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
  base_temp: z.number().default(10).describe("Base temperature for growing degree days in °C (default: 10°C)"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

// Tool 5: Get Historical Weather
const GetHistoricalWeatherArgsSchema = z.object({
  city: z.string().optional().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
  month: z.number().min(1).max(12).describe("Month (1-12)"),
  years_back: z.number().min(1).max(10).default(1).describe("Number of years back to retrieve data (1-10, default: 1 for past year)"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

// Tool 6: Get Hourly Weather
const GetHourlyWeatherArgsSchema = z.object({
  city: z.string().optional().describe("City name"),
  country: z.string().optional().describe("Country code (optional)"),
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
  hours: z.number().min(1).max(168).default(24).describe("Number of hours to forecast (1-168, default: 24)"),
}).refine(
  (data) => (data.city !== undefined) || (data.latitude !== undefined && data.longitude !== undefined),
  { message: "Either 'city' or both 'latitude' and 'longitude' must be provided" }
);

// Helper functions are now imported from helpers.js

async function fetchCurrentWeather(
  city?: string,
  country?: string,
  latitude?: number,
  longitude?: number
) {
  let location: { latitude: number; longitude: number; name: string; country: string; timezone: string };

  // If coordinates provided, use them directly
  if (latitude !== undefined && longitude !== undefined) {
    location = {
      latitude,
      longitude,
      name: "Coordinates",
      country: "",
      timezone: "auto",
    };
  } else if (city) {
    // Otherwise geocode the city
    location = await geocodeCity(city, country);
  } else {
    throw new Error("Either city or coordinates must be provided");
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=${location.timezone}`;

  // Use fetchWeatherData with improved error handling
  const data = await fetchWeatherData(weatherUrl);

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

async function fetchWeatherForecast(
  city?: string,
  country?: string,
  days: number = 7,
  latitude?: number,
  longitude?: number
) {
  let location: { latitude: number; longitude: number; name: string; country: string; timezone: string };

  // If coordinates provided, use them directly
  if (latitude !== undefined && longitude !== undefined) {
    location = {
      latitude,
      longitude,
      name: "Coordinates",
      country: "",
      timezone: "auto",
    };
  } else if (city) {
    // Otherwise geocode the city
    location = await geocodeCity(city, country);
  } else {
    throw new Error("Either city or coordinates must be provided");
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=${location.timezone}&forecast_days=${days}`;

  // Use fetchWeatherData with improved error handling
  const data = await fetchWeatherData(weatherUrl);

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

async function fetchWeatherAlerts(
  city?: string,
  country?: string,
  latitude?: number,
  longitude?: number
) {
  let location: { latitude: number; longitude: number; name: string; country: string; timezone: string };

  // If coordinates provided, use them directly
  if (latitude !== undefined && longitude !== undefined) {
    location = {
      latitude,
      longitude,
      name: "Coordinates",
      country: "",
      timezone: "auto",
    };
  } else if (city) {
    // Otherwise geocode the city
    location = await geocodeCity(city, country);
  } else {
    throw new Error("Either city or coordinates must be provided");
  }

  const currentWeather = await fetchCurrentWeather(city, country, latitude, longitude);

  // Open-Meteo doesn't provide official alerts, but we can create warnings based on conditions
  const alerts: string[] = [];

  // Extract numeric values
  const temp = parseFloat(currentWeather.current.temperature.replace("°C", ""));
  const windSpeed = parseFloat(currentWeather.current.wind_speed.replace(" km/h", ""));
  const precipitation = parseFloat(currentWeather.current.precipitation.replace(" mm", ""));

  // Check for extreme conditions
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

async function fetchGrowingConditions(
  city?: string,
  country?: string,
  baseTemp: number = 10,
  latitude?: number,
  longitude?: number
) {
  let location: { latitude: number; longitude: number; name: string; country: string; timezone: string };

  // If coordinates provided, use them directly
  if (latitude !== undefined && longitude !== undefined) {
    location = {
      latitude,
      longitude,
      name: "Coordinates",
      country: "",
      timezone: "auto",
    };
  } else if (city) {
    // Otherwise geocode the city
    location = await geocodeCity(city, country);
  } else {
    throw new Error("Either city or coordinates must be provided");
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,soil_temperature_0_to_7cm,soil_moisture_0_to_7cm&hourly=temperature_2m,shortwave_radiation&timezone=${location.timezone}&forecast_days=1`;

  // Use fetchWeatherData with improved error handling
  const data = await fetchWeatherData(weatherUrl);

  // Calculate Growing Degree Days (GDD) for today
  const hourlyTemps = data.hourly.temperature_2m.slice(0, 24);
  const avgTemp = hourlyTemps.reduce((sum: number, temp: number) => sum + temp, 0) / hourlyTemps.length;
  const gdd = Math.max(0, avgTemp - baseTemp);

  // Calculate average solar radiation for today
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

async function fetchHistoricalWeather(
  city?: string,
  month: number = 1,
  country?: string,
  yearsBack: number = 1,
  latitude?: number,
  longitude?: number
) {
  let location: { latitude: number; longitude: number; name: string; country: string; timezone: string };

  // If coordinates provided, use them directly
  if (latitude !== undefined && longitude !== undefined) {
    location = {
      latitude,
      longitude,
      name: "Coordinates",
      country: "",
      timezone: "auto",
    };
  } else if (city) {
    // Otherwise geocode the city
    location = await geocodeCity(city, country);
  } else {
    throw new Error("Either city or coordinates must be provided");
  }

  const currentYear = new Date().getFullYear();
  const monthName = new Date(2000, month - 1).toLocaleString('en', { month: 'long' });

  const historicalData = [];

  // Fetch data for each year
  for (let i = 0; i < yearsBack; i++) {
    const year = currentYear - 1 - i;

    // Calculate start and end dates for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=${location.timezone}`;

    // Use fetchWeatherData with improved error handling
    const data = await fetchWeatherData(weatherUrl);

    // Calculate monthly statistics
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

async function fetchHourlyWeather(
  city?: string,
  country?: string,
  hours: number = 24,
  latitude?: number,
  longitude?: number
) {
  let location: { latitude: number; longitude: number; name: string; country: string; timezone: string };

  // If coordinates provided, use them directly
  if (latitude !== undefined && longitude !== undefined) {
    location = {
      latitude,
      longitude,
      name: "Coordinates",
      country: "",
      timezone: "auto",
    };
  } else if (city) {
    // Otherwise geocode the city
    location = await geocodeCity(city, country);
  } else {
    throw new Error("Either city or coordinates must be provided");
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=${location.timezone}&forecast_hours=${hours}`;

  // Use fetchWeatherData with improved error handling
  const data = await fetchWeatherData(weatherUrl);

  // Map hourly data
  const hourlyForecast = data.hourly.time.map((time: string, index: number) => ({
    time,
    temperature: `${data.hourly.temperature_2m[index]}°C`,
    feels_like: `${data.hourly.apparent_temperature[index]}°C`,
    humidity: `${data.hourly.relative_humidity_2m[index]}%`,
    precipitation: `${data.hourly.precipitation[index]} mm`,
    weather: WEATHER_CODES[data.hourly.weather_code[index]] || "Unknown",
    wind_speed: `${data.hourly.wind_speed_10m[index]} km/h`,
    wind_direction: `${data.hourly.wind_direction_10m[index]}°`,
    wind_gusts: `${data.hourly.wind_gusts_10m[index]} km/h`,
  }));

  return {
    location: `${location.name}, ${location.country}`,
    timezone: location.timezone,
    hours_forecasted: hours,
    hourly_forecast: hourlyForecast,
  };
}

// ============================================
// MCP SERVER SETUP
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

// ============================================
// REGISTER MCP TOOLS
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ========================================
      // TOOL 1: GET CURRENT WEATHER
      // ========================================
      {
        name: "get_current_weather",
        description:
          "Get real-time current weather conditions for any city worldwide. Returns temperature, feels-like temperature, humidity, precipitation, weather description, and wind information. Accepts either city name OR latitude/longitude coordinates.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name (e.g., 'London', 'Tokyo', 'New York'). Required if latitude/longitude not provided.",
            },
            country: {
              type: "string",
              description: "Optional country code for disambiguation (e.g., 'US', 'GB', 'JP')",
            },
            latitude: {
              type: "number",
              description: "Latitude coordinate. Must be provided with longitude if city is not specified.",
            },
            longitude: {
              type: "number",
              description: "Longitude coordinate. Must be provided with latitude if city is not specified.",
            },
          },
          required: [],
        },
      },

      // ========================================
      // TOOL 2: GET WEATHER FORECAST
      // ========================================
      {
        name: "get_weather_forecast",
        description:
          "Get weather forecast for up to 16 days. Returns daily predictions including max/min temperatures, precipitation, weather conditions, and wind speeds. Perfect for planning trips or events. Accepts either city name OR latitude/longitude coordinates.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name. Required if latitude/longitude not provided.",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
            latitude: {
              type: "number",
              description: "Latitude coordinate. Must be provided with longitude if city is not specified.",
            },
            longitude: {
              type: "number",
              description: "Longitude coordinate. Must be provided with latitude if city is not specified.",
            },
            days: {
              type: "number",
              description: "Number of forecast days (1-16, default: 7)",
              minimum: 1,
              maximum: 16,
            },
          },
          required: [],
        },
      },

      // ========================================
      // TOOL 3: GET WEATHER ALERTS
      // ========================================
      {
        name: "get_weather_alerts",
        description:
          "Check for weather warnings and alerts based on current conditions. Detects extreme temperatures, high winds, heavy precipitation, and severe weather like thunderstorms. Accepts either city name OR latitude/longitude coordinates.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name. Required if latitude/longitude not provided.",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
            latitude: {
              type: "number",
              description: "Latitude coordinate. Must be provided with longitude if city is not specified.",
            },
            longitude: {
              type: "number",
              description: "Longitude coordinate. Must be provided with latitude if city is not specified.",
            },
          },
          required: [],
        },
      },

      // ========================================
      // TOOL 4: GET GROWING CONDITIONS
      // ========================================
      {
        name: "get_growing_conditions",
        description:
          "Get current growing conditions including Growing Degree Days (GDD), solar radiation, humidity, and soil metrics. Used to predict crop development stages and optimize growing conditions. Accepts either city name OR latitude/longitude coordinates.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name. Required if latitude/longitude not provided.",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
            latitude: {
              type: "number",
              description: "Latitude coordinate. Must be provided with longitude if city is not specified.",
            },
            longitude: {
              type: "number",
              description: "Longitude coordinate. Must be provided with latitude if city is not specified.",
            },
            base_temp: {
              type: "number",
              description: "Base temperature for GDD calculation in °C (default: 10°C, common for many crops)",
            },
          },
          required: [],
        },
      },

      // ========================================
      // TOOL 5: GET HISTORICAL WEATHER
      // ========================================
      {
        name: "get_historical_weather",
        description:
          "Retrieve historical weather data for a specific month over multiple years. Returns monthly statistics including average, max, and min temperatures, total precipitation, and average wind speed. Default retrieves data for the past year, up to 10 years available. Accepts either city name OR latitude/longitude coordinates.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name. Required if latitude/longitude not provided.",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
            latitude: {
              type: "number",
              description: "Latitude coordinate. Must be provided with longitude if city is not specified.",
            },
            longitude: {
              type: "number",
              description: "Longitude coordinate. Must be provided with latitude if city is not specified.",
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
          required: ["month"],
        },
      },

      // ========================================
      // TOOL 6: GET HOURLY WEATHER
      // ========================================
      {
        name: "get_hourly_weather",
        description:
          "Get hour-by-hour weather forecast for up to 7 days (168 hours). Returns detailed hourly predictions including temperature, feels-like temperature, humidity, precipitation, weather conditions, wind speed, direction, and gusts. Perfect for planning daily activities or tracking weather changes throughout the day. Accepts either city name OR latitude/longitude coordinates.",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "City name. Required if latitude/longitude not provided.",
            },
            country: {
              type: "string",
              description: "Optional country code",
            },
            latitude: {
              type: "number",
              description: "Latitude coordinate. Must be provided with longitude if city is not specified.",
            },
            longitude: {
              type: "number",
              description: "Longitude coordinate. Must be provided with latitude if city is not specified.",
            },
            hours: {
              type: "number",
              description: "Number of hours to forecast (1-168, default: 24)",
              minimum: 1,
              maximum: 168,
            },
          },
          required: [],
        },
      },
    ],
  };
});

// ============================================
// HANDLE TOOL CALLS
// ============================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // ========================================
    // TOOL 1: GET CURRENT WEATHER
    // ========================================
    if (request.params.name === "get_current_weather") {
      const args = GetCurrentWeatherArgsSchema.parse(request.params.arguments);
      const weatherData = await fetchCurrentWeather(args.city, args.country, args.latitude, args.longitude);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(weatherData, null, 2),
          },
        ],
      };
    }

    // ========================================
    // TOOL 2: GET WEATHER FORECAST
    // ========================================
    else if (request.params.name === "get_weather_forecast") {
      const args = GetWeatherForecastArgsSchema.parse(request.params.arguments);
      const forecastData = await fetchWeatherForecast(args.city, args.country, args.days, args.latitude, args.longitude);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(forecastData, null, 2),
          },
        ],
      };
    }

    // ========================================
    // TOOL 3: GET WEATHER ALERTS
    // ========================================
    else if (request.params.name === "get_weather_alerts") {
      const args = GetWeatherAlertsArgsSchema.parse(request.params.arguments);
      const alertsData = await fetchWeatherAlerts(args.city, args.country, args.latitude, args.longitude);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(alertsData, null, 2),
          },
        ],
      };
    }

    // ========================================
    // TOOL 4: GET GROWING CONDITIONS
    // ========================================
    else if (request.params.name === "get_growing_conditions") {
      const args = GetGrowingConditionsArgsSchema.parse(request.params.arguments);
      const growingData = await fetchGrowingConditions(args.city, args.country, args.base_temp, args.latitude, args.longitude);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(growingData, null, 2),
          },
        ],
      };
    }

    // ========================================
    // TOOL 5: GET HISTORICAL WEATHER
    // ========================================
    else if (request.params.name === "get_historical_weather") {
      const args = GetHistoricalWeatherArgsSchema.parse(request.params.arguments);
      const historicalData = await fetchHistoricalWeather(args.city, args.month, args.country, args.years_back, args.latitude, args.longitude);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(historicalData, null, 2),
          },
        ],
      };
    }

    // ========================================
    // TOOL 6: GET HOURLY WEATHER
    // ========================================
    else if (request.params.name === "get_hourly_weather") {
      const args = GetHourlyWeatherArgsSchema.parse(request.params.arguments);
      const hourlyData = await fetchHourlyWeather(args.city, args.country, args.hours, args.latitude, args.longitude);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(hourlyData, null, 2),
          },
        ],
      };
    }

    // Unknown tool
    else {
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
// START THE SERVER
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
  console.error("Available tools:");
  console.error("  1. get_current_weather - Real-time weather conditions");
  console.error("  2. get_weather_forecast - Multi-day weather forecast (up to 16 days)");
  console.error("  3. get_weather_alerts - Weather warnings and alerts");
  console.error("  4. get_growing_conditions - Growing Degree Days, solar radiation, and crop conditions");
  console.error("  5. get_historical_weather - Historical weather data for a specific month (up to 10 years)");
  console.error("  6. get_hourly_weather - Hour-by-hour weather forecast (up to 168 hours)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});