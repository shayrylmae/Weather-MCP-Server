# Testing Guide for Weather MCP Server

This guide explains how to test all 5 MCP tools on your deployed Render server.

## 🌐 Deployed Server
**URL:** https://weather-mcp-server-67ou.onrender.com

## 🛠️ Available Tools

1. **get_current_weather** - Real-time weather conditions
2. **get_weather_forecast** - Multi-day forecasts (1-16 days)
3. **get_weather_alerts** - Weather warnings and alerts
4. **get_growing_conditions** - Agricultural data (GDD, soil metrics)
5. **get_historical_weather** - Historical weather statistics

---

## 📋 Test Methods

### Method 1: Browser Testing (Recommended) 🌐

**File:** `test-sse.html`

**How to use:**
1. Open `test-sse.html` in your browser
2. The page automatically connects to your Render server
3. Use the buttons to test each tool:

**Available Tests:**
- ☀️ **Current Weather** - Get real-time weather for any city
- 📅 **7-Day Forecast** - Get week-long weather forecast
- ⚠️ **Weather Alerts** - Check for weather warnings
- 📊 **Historical Data** - Get past weather data (up to 10 years)
- 🌾 **Growing Conditions** - Get agricultural metrics (GDD, soil data)

**Example: Test Historical Weather for Manila (3 years)**
1. City: `Manila`
2. Month: Leave empty (uses current month) or enter `10` for October
3. Years back: `3`
4. Click "Historical Data"

---

### Method 2: Node.js Testing 💻

**File:** `test-render.js`

**Run:**
```bash
node test-render.js
```

**What it tests:**
1. ✅ Health Check
2. ✅ Server Info
3. ✅ Current Weather (Manila)
4. ✅ 7-Day Forecast (Manila)
5. ✅ Weather Alerts (Manila)
6. ✅ Growing Conditions (Manila, base temp 10°C)
7. ⭐ Historical Weather (Manila, current month, 3 years)

**Sample Output:**
```
═══════════════════════════════════════════════════════════
  Weather MCP Server Test - Render Deployment
  URL: https://weather-mcp-server-67ou.onrender.com
═══════════════════════════════════════════════════════════

1. Health Check
   Testing server connectivity...
   ✓ Success
   Status: ok
   Transport: SSE
   Active Connections: 0

...

7. Historical Weather (Manila, 3 years) ⭐
   Tool: get_historical_weather
   Parameters: month=10 (October), years_back=3
   ✓ Success
   Location: Manila, PH
   Month: October
   Years Retrieved: 3

   Year 2024:
     Avg Temperature: 27.5°C
     Max Temperature: 32.1°C
     Min Temperature: 24.2°C
     Total Precipitation: 245.3 mm
     Avg Wind Speed: 12.4 km/h
     Days in Month: 31
```

---

### Method 3: Bash/cURL Testing 🔧

**File:** `test-render.sh`

**Run:**
```bash
chmod +x test-render.sh
./test-render.sh
```

**What it does:**
- Tests health check endpoint
- Tests server info endpoint
- Shows example cURL commands for all tools
- Provides instructions for full testing

---

## 🧪 Manual Testing with cURL

### Test 1: Current Weather
```bash
curl -X POST "https://weather-mcp-server-67ou.onrender.com/message" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_current_weather",
      "arguments": {
        "city": "Manila",
        "country": "PH"
      }
    }
  }'
```

### Test 2: Weather Forecast (7 days)
```bash
curl -X POST "https://weather-mcp-server-67ou.onrender.com/message" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_weather_forecast",
      "arguments": {
        "city": "Manila",
        "country": "PH",
        "days": 7
      }
    }
  }'
```

### Test 3: Weather Alerts
```bash
curl -X POST "https://weather-mcp-server-67ou.onrender.com/message" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_weather_alerts",
      "arguments": {
        "city": "Manila",
        "country": "PH"
      }
    }
  }'
```

### Test 4: Growing Conditions
```bash
curl -X POST "https://weather-mcp-server-67ou.onrender.com/message" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_growing_conditions",
      "arguments": {
        "city": "Manila",
        "country": "PH",
        "base_temp": 10
      }
    }
  }'
```

### Test 5: Historical Weather (Manila, October, 3 years) ⭐
```bash
curl -X POST "https://weather-mcp-server-67ou.onrender.com/message" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "get_historical_weather",
      "arguments": {
        "city": "Manila",
        "country": "PH",
        "month": 10,
        "years_back": 3
      }
    }
  }'
```

---

## 📊 Understanding the Responses

### Historical Weather Response Structure
```json
{
  "location": "Manila, PH",
  "timezone": "Asia/Manila",
  "month": "October",
  "years_retrieved": 3,
  "historical_data": [
    {
      "year": 2024,
      "month": "October",
      "statistics": {
        "avg_temperature": "27.5°C",
        "max_temperature": "32.1°C",
        "min_temperature": "24.2°C",
        "total_precipitation": "245.3 mm",
        "avg_wind_speed": "12.4 km/h"
      },
      "days_in_month": 31
    }
    // ... more years
  ]
}
```

### Growing Conditions Response Structure
```json
{
  "location": "Manila, PH",
  "timezone": "Asia/Manila",
  "current_conditions": {
    "air_temperature": "28.5°C",
    "relative_humidity": "75%",
    "soil_temperature": "26.2°C",
    "soil_moisture": "0.35 m³/m³"
  },
  "growing_metrics": {
    "growing_degree_days": "18.50 GDD (base 10°C)",
    "avg_solar_radiation": "245.67 W/m²",
    "description": "Conditions favorable for plant growth"
  },
  "measured_at": "2024-10-15T10:00:00"
}
```

---

## 🔍 Troubleshooting

### SSE Session Required Error
If you get a "Session not found" error with cURL:
- This is expected for SSE transport
- **Solution:** Use the browser test (`test-sse.html`) which properly handles SSE connections
- Or use the Node.js test (`test-render.js`)

### Connection Timeout
If the request times out:
- The Render free tier may spin down after inactivity
- First request might take 30-60 seconds to wake up the server
- Subsequent requests will be fast

### CORS Errors (Browser)
- The server has CORS enabled with `Access-Control-Allow-Origin: *`
- If you still get CORS errors, check that you're using HTTPS (not HTTP)

---

## ✅ Quick Start

**For the fastest testing experience:**

1. **Browser Test (Visual):**
   ```
   Open test-sse.html in your browser
   ```

2. **Node.js Test (Comprehensive):**
   ```bash
   node test-render.js
   ```

3. **Bash Test (Quick Check):**
   ```bash
   ./test-render.sh
   ```

---

## 📝 Notes

- All tests use Manila, Philippines as the default city
- Historical weather uses the current month by default
- Growing conditions use 10°C as the default base temperature
- All timestamps are in the location's local timezone
- Weather codes are automatically translated to human-readable descriptions

Happy testing! 🎉
