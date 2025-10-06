# Integration Guide: Weather MCP Server with Soil Health App

This guide explains how to integrate your Weather MCP Server with your Soil Health app for **natural language AI interaction**.

## Overview

Your Weather MCP Server provides 5 weather tools via the Model Context Protocol:
1. **Current Weather** - Real-time conditions
2. **Weather Forecast** - Up to 16-day predictions
3. **Weather Alerts** - Extreme weather warnings
4. **Growing Conditions** - GDD, soil temperature/moisture, solar radiation (🌾 Perfect for agriculture!)
5. **Historical Weather** - Monthly statistics for up to 10 years

## Integration Methods

### Method 1: Natural Language AI (Recommended) ⭐

**Best for:** Apps where users ask questions like "What's the weather in Manila?" and the AI automatically handles the interaction.

#### Setup Claude Desktop with MCP:

1. **Build your MCP server first:**
   ```bash
   npm run build
   ```

2. **Edit Claude Desktop configuration:**
   ```bash
   # macOS
   nano ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Windows
   notepad %APPDATA%\Claude\claude_desktop_config.json

   # Linux
   nano ~/.config/Claude/claude_desktop_config.json
   ```

3. **Add this configuration:**
   ```json
   {
     "mcpServers": {
       "weather": {
         "command": "node",
         "args": ["/Users/shayryl/weather-mcp-server/dist/index.js"]
       }
     }
   }
   ```

   **⚠️ Important:** Replace `/Users/shayryl/weather-mcp-server` with your actual absolute path!

4. **Restart Claude Desktop** completely (quit and reopen)

5. **Verify it's working:**
   - Look for a 🔌 icon in Claude Desktop
   - Click it to see available MCP servers
   - "weather" should be listed with 5 tools

#### How Natural Language Works:

Once configured, users can interact naturally:

**Example 1: Simple Query**
```
User: "What's the weather in Manila?"
AI: [Automatically calls get_current_weather]
    "The current weather in Manila is:
     🌡️ Temperature: 28.7°C (feels like 34.8°C)
     💧 Humidity: 83%
     🌤️ Conditions: Overcast
     💨 Wind: 6.5 km/h"
```

**Example 2: Missing Information**
```
User: "Check growing conditions"
AI: "I'll check the growing conditions for you. Which city is your farm located in?"
User: "Cebu"
AI: [Calls get_growing_conditions for Cebu]
    "Growing conditions in Cebu:
     🌡️ Air Temperature: 29.2°C
     🌱 Soil Temperature: 27.8°C
     💧 Soil Moisture: 0.31 m³/m³
     ☀️ Solar Radiation: 432 W/m²
     📊 Growing Degree Days: 19.2 GDD (base 10°C)
     ✅ Conditions favorable for plant growth"
```

**Example 3: Complex Request**
```
User: "Show me the 5-day forecast for Davao and check if there are any weather warnings"
AI: [Automatically calls get_weather_forecast AND get_weather_alerts]
    [Displays both forecast and alerts in one response]
```

**Example 4: Historical Data**
```
User: "What was the weather like in Manila last September?"
AI: "I'll get the historical weather data for Manila in September. How many years back would you like? (1-10 years)"
User: "Past 3 years"
AI: [Calls get_historical_weather]
    [Shows monthly statistics for Sept 2022, 2023, 2024]
```

#### Advantages of Natural Language Integration:

✅ **Automatic parameter extraction** - AI extracts city, dates, etc. from natural language
✅ **Interactive clarification** - AI asks users for missing required parameters
✅ **Intelligent defaults** - AI suggests reasonable defaults for optional parameters
✅ **Multi-tool orchestration** - AI can call multiple tools in one response
✅ **Context awareness** - AI remembers previous conversation context
✅ **User-friendly formatting** - AI formats raw data into readable responses

---

### Method 2: HTTP API (For Direct Integration)

**Best for:** Programmatic access, dashboards, automated systems, or mobile apps.

#### Quick Start

1. **Start the HTTP Proxy Server:**
   ```bash
   npm run proxy
   ```
   This starts an HTTP server on `http://localhost:3002`.

2. **Test the Endpoints:**

Open your browser or use curl:

```bash
# API Documentation
curl http://localhost:3002/

# Health Check
curl http://localhost:3002/health

# Current Weather
curl "http://localhost:3002/weather/current?city=Manila&country=PH"

# Weather Forecast (7 days)
curl "http://localhost:3002/weather/forecast?city=Manila&days=7"

# Growing Conditions (🌾 Agricultural data!)
curl "http://localhost:3002/weather/growing?city=Manila&baseTemp=10"

# Weather Alerts
curl "http://localhost:3002/weather/alerts?city=Manila"

# Historical Weather (September, past 3 years)
curl "http://localhost:3002/weather/historical?city=Manila&month=9&yearsBack=3"
```

## Integration with Your Next.js App

### Option 1: Update Existing API Routes

Modify your Next.js API routes in `src/app/api/` to fetch from your local MCP server:

**Example: `/src/app/api/weather/route.ts`**

```typescript
// Replace Vectorize.io calls with your MCP server
const MCP_BASE_URL = process.env.MCP_SERVER_URL || 'http://localhost:3002';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city') || 'Manila';

  try {
    // Current weather
    const currentResponse = await fetch(
      `${MCP_BASE_URL}/weather/current?city=${city}&country=PH`
    );
    const current = await currentResponse.json();

    // Growing conditions for agriculture
    const growingResponse = await fetch(
      `${MCP_BASE_URL}/weather/growing?city=${city}&baseTemp=10`
    );
    const growing = await growingResponse.json();

    // Forecast
    const forecastResponse = await fetch(
      `${MCP_BASE_URL}/weather/forecast?city=${city}&days=7`
    );
    const forecast = await forecastResponse.json();

    return Response.json({
      current,
      growing,
      forecast
    });
  } catch (error) {
    return Response.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
```

### Option 2: Create a New Weather Service

Create a new service file: `/src/lib/weather-mcp.ts`

```typescript
const MCP_BASE_URL = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'http://localhost:3002';

export interface WeatherData {
  location: string;
  timezone: string;
  current: {
    temperature: string;
    feels_like: string;
    humidity: string;
    precipitation: string;
    weather: string;
    wind_speed: string;
    wind_direction: string;
  };
  time: string;
}

export interface GrowingConditions {
  location: string;
  timezone: string;
  current_conditions: {
    air_temperature: string;
    relative_humidity: string;
    soil_temperature: string;
    soil_moisture: string;
  };
  growing_metrics: {
    growing_degree_days: string;
    avg_solar_radiation: string;
    description: string;
  };
  measured_at: string;
}

export class WeatherMCPService {
  private baseUrl: string;

  constructor(baseUrl: string = MCP_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getCurrentWeather(city: string, country?: string): Promise<WeatherData> {
    const params = new URLSearchParams({ city });
    if (country) params.append('country', country);

    const response = await fetch(`${this.baseUrl}/weather/current?${params}`);
    if (!response.ok) throw new Error('Failed to fetch current weather');
    return response.json();
  }

  async getGrowingConditions(
    city: string,
    baseTemp: number = 10,
    country?: string
  ): Promise<GrowingConditions> {
    const params = new URLSearchParams({
      city,
      baseTemp: baseTemp.toString()
    });
    if (country) params.append('country', country);

    const response = await fetch(`${this.baseUrl}/weather/growing?${params}`);
    if (!response.ok) throw new Error('Failed to fetch growing conditions');
    return response.json();
  }

  async getForecast(city: string, days: number = 7, country?: string) {
    const params = new URLSearchParams({
      city,
      days: days.toString()
    });
    if (country) params.append('country', country);

    const response = await fetch(`${this.baseUrl}/weather/forecast?${params}`);
    if (!response.ok) throw new Error('Failed to fetch forecast');
    return response.json();
  }

  async getAlerts(city: string, country?: string) {
    const params = new URLSearchParams({ city });
    if (country) params.append('country', country);

    const response = await fetch(`${this.baseUrl}/weather/alerts?${params}`);
    if (!response.ok) throw new Error('Failed to fetch alerts');
    return response.json();
  }

  async getHistoricalWeather(
    city: string,
    month: number,
    yearsBack: number = 1,
    country?: string
  ) {
    const params = new URLSearchParams({
      city,
      month: month.toString(),
      yearsBack: yearsBack.toString()
    });
    if (country) params.append('country', country);

    const response = await fetch(`${this.baseUrl}/weather/historical?${params}`);
    if (!response.ok) throw new Error('Failed to fetch historical weather');
    return response.json();
  }
}

// Export singleton instance
export const weatherMCP = new WeatherMCPService();
```

### Usage in Your Components

```typescript
import { weatherMCP } from '@/lib/weather-mcp';

export default async function WeatherDashboard() {
  const current = await weatherMCP.getCurrentWeather('Manila', 'PH');
  const growing = await weatherMCP.getGrowingConditions('Manila', 10, 'PH');

  return (
    <div>
      <h2>Current Conditions</h2>
      <p>Temperature: {current.current.temperature}</p>
      <p>Humidity: {current.current.humidity}</p>

      <h2>Growing Conditions 🌾</h2>
      <p>Soil Temperature: {growing.current_conditions.soil_temperature}</p>
      <p>Soil Moisture: {growing.current_conditions.soil_moisture}</p>
      <p>GDD: {growing.growing_metrics.growing_degree_days}</p>
      <p>Solar Radiation: {growing.growing_metrics.avg_solar_radiation}</p>
    </div>
  );
}
```

## Environment Variables

Add to your Next.js `.env.local`:

```env
# For server-side API routes
MCP_SERVER_URL=http://localhost:3002

# For client-side components (if needed)
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:3002
```

## API Reference

### GET /weather/current
Get real-time weather conditions.

**Query Parameters:**
- `city` (required) - City name
- `country` (optional) - ISO country code (e.g., PH, US, GB)

**Example Response:**
```json
{
  "location": "Manila, PH",
  "timezone": "Asia/Manila",
  "current": {
    "temperature": "28.5°C",
    "feels_like": "32.1°C",
    "humidity": "75%",
    "precipitation": "0 mm",
    "weather": "Partly cloudy",
    "wind_speed": "12.5 km/h",
    "wind_direction": "180°"
  },
  "time": "2025-10-06T14:30:00"
}
```

### GET /weather/growing
Get agricultural growing conditions (🌾 Key for your app!)

**Query Parameters:**
- `city` (required) - City name
- `baseTemp` (optional) - Base temperature for GDD (default: 10°C)
- `country` (optional) - ISO country code

**Example Response:**
```json
{
  "location": "Manila, PH",
  "timezone": "Asia/Manila",
  "current_conditions": {
    "air_temperature": "28.5°C",
    "relative_humidity": "75%",
    "soil_temperature": "26.3°C",
    "soil_moisture": "0.28 m³/m³"
  },
  "growing_metrics": {
    "growing_degree_days": "18.50 GDD (base 10°C)",
    "avg_solar_radiation": "425.32 W/m²",
    "description": "Conditions favorable for plant growth"
  },
  "measured_at": "2025-10-06T14:30:00"
}
```

### GET /weather/forecast
Get multi-day weather forecast.

**Query Parameters:**
- `city` (required) - City name
- `days` (optional) - Number of days (1-16, default: 7)
- `country` (optional) - ISO country code

### GET /weather/alerts
Check for weather warnings and alerts.

**Query Parameters:**
- `city` (required) - City name
- `country` (optional) - ISO country code

### GET /weather/historical
Retrieve historical weather data.

**Query Parameters:**
- `city` (required) - City name
- `month` (required) - Month number (1-12)
- `yearsBack` (optional) - Years to retrieve (1-10, default: 1)
- `country` (optional) - ISO country code

## Testing Checklist

- [ ] HTTP proxy server starts without errors (`npm run proxy`)
- [ ] Health check endpoint responds (`/health`)
- [ ] Can fetch current weather for Manila
- [ ] Can fetch growing conditions (soil data, GDD)
- [ ] Can fetch 7-day forecast
- [ ] Can fetch weather alerts
- [ ] Can fetch historical data
- [ ] Next.js app successfully calls MCP endpoints
- [ ] Data displays correctly in your UI

## Troubleshooting

### MCP Server Not Starting
```bash
# Make sure you have dependencies installed
npm install

# Run the MCP server directly first
npm run dev
```

### Connection Refused Errors
- Ensure the proxy is running on port 3002
- Check firewall settings
- Verify no other service is using port 3002

### CORS Issues
The proxy includes CORS headers, but if you encounter issues:
- Use server-side API routes in Next.js (recommended)
- Don't call MCP endpoints directly from client-side code

### Empty or Error Responses
- Check MCP server logs in the proxy console
- Verify city names are spelled correctly
- Try adding country code for disambiguation

## Production Deployment

For production, you'll want to:

1. Deploy MCP server as a standalone service
2. Use environment variables for the URL
3. Add authentication/rate limiting
4. Consider caching responses
5. Monitor API usage and errors

## Support

- Weather MCP Server: This repository
- Soil-Agri-Weather App: https://github.com/shayrylmae/soil-agri-weather
- Open-Meteo API: https://open-meteo.com/
