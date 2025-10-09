# Weather MCP Server

A Model Context Protocol (MCP) server that provides real-time and historical weather data using the Open-Meteo API. This server enables AI assistants and applications to access comprehensive weather information through a standardized interface.

## Features

This MCP server provides 5 powerful weather tools:

### 1. **get_current_weather**
Get real-time current weather conditions for any city worldwide.
- Temperature (actual and feels-like)
- Humidity
- Precipitation
- Weather description
- Wind speed and direction

### 2. **get_weather_forecast**
Retrieve weather forecasts for up to 16 days ahead.
- Daily max/min temperatures
- Precipitation predictions
- Weather conditions
- Wind speeds
- Perfect for trip planning and event scheduling

### 3. **get_weather_alerts**
Check for weather warnings and alerts based on current conditions.
- Extreme temperature warnings
- High wind alerts
- Heavy precipitation notices
- Thunderstorm warnings
- Real-time condition-based alerts

### 4. **get_growing_conditions**
Access agricultural and gardening data.
- Growing Degree Days (GDD) calculation
- Solar radiation levels
- Soil temperature and moisture
- Humidity metrics
- Customizable base temperature for different crops

### 5. **get_historical_weather**
Retrieve historical weather data for specific months.
- Monthly statistics over multiple years (up to 10 years back)
- Average, max, and min temperatures
- Total precipitation
- Average wind speed
- Climate trend analysis

## Installation

### Prerequisites
- Node.js 16 or higher
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd weather-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### Deployment Options

This server supports multiple transport modes:

#### 1. **SSE Transport** (Recommended for HTTP) ⭐

Server-Sent Events transport provides a persistent, stateful connection over HTTP.

```bash
npm run dev:sse    # Development (port 3003)
npm run start:sse  # Production (port 3003)
```

**Benefits:**
- ✅ Persistent connection maintains state across tool calls
- ✅ Native MCP protocol support over HTTP
- ✅ Better efficiency for streaming AI interactions
- ✅ Standards-compliant SSE implementation

**Test it:**
```bash
curl http://localhost:3003/health
curl http://localhost:3003/
```

#### 2. **HTTP Proxy** (Simple REST API)

Request-response HTTP wrapper for quick testing and REST API usage.

```bash
npm run proxy      # Runs on port 3002
```

**Test it:**
```bash
npm test
curl "http://localhost:3002/weather/current?city=Manila&country=PH"
```

#### 3. **Stdio Transport** (Original)

Standard MCP over stdio for Claude Desktop and MCP Inspector.

```bash
npm run dev        # Development
npm start          # Production
```

See **[INTEGRATION.md](./INTEGRATION.md)** for integrating with your Next.js app.

> 📖 **For detailed information about improvements and architecture**, see **[IMPROVEMENTS.md](./IMPROVEMENTS.md)**

### Running the MCP Server Directly

**Development mode** (with hot reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

### Configuration with Claude Desktop

Add this server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/weather-mcp-server/dist/index.js"]
    }
  }
}
```

Or use the development version:
```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/weather-mcp-server/src/index.ts"]
    }
  }
}
```

### Configuration with Other MCP Clients

This server uses the standard MCP protocol over stdio, so it can be integrated with any MCP-compatible client. Refer to your client's documentation for specific configuration instructions.

## Development

### Project Structure

```
weather-mcp-server/
├── src/
│   ├── index.ts          # Main MCP server (stdio transport)
│   └── sse-server.ts     # SSE transport server (NEW)
├── dist/
│   ├── index.js          # Compiled stdio server
│   └── sse-server.js     # Compiled SSE server
├── http-proxy.js         # HTTP proxy wrapper (refactored)
├── test-integration.js   # Integration test suite
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── CLAUDE.md            # Claude Code instructions
├── INTEGRATION.md       # Integration guide for Next.js
├── IMPROVEMENTS.md      # Detailed improvements documentation (NEW)
└── README.md            # This file
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run stdio transport in development mode
- `npm run dev:sse` - Run SSE transport in development mode (port 3003) ⭐
- `npm start` - Run the compiled stdio transport
- `npm run start:sse` - Run the compiled SSE transport (port 3003) ⭐
- `npm run proxy` - Build and start HTTP proxy server (port 3002)
- `npm test` - Run integration tests (requires proxy to be running)
- `npm run test:inspector` - Test with MCP Inspector (interactive UI)

### Testing

**Option 1: Integration Tests** (Recommended)

Start the HTTP proxy and run automated tests:
```bash
# Terminal 1: Start the proxy
npm run proxy

# Terminal 2: Run tests
npm test
```

**Option 2: MCP Inspector** (Interactive UI)

```bash
npm run test:inspector
```

This will open a web interface where you can:
- View all available tools
- Test each tool with different inputs
- See responses in real-time
- Debug any issues

### Making Changes

1. Edit `src/index.ts` to modify or add tools
2. Run `npm run build` to compile
3. Test using one of these methods:
   - `npm run proxy` then `npm test` for automated tests
   - `npm run test:inspector` for interactive testing
   - Restart your MCP client (e.g., Claude Desktop)

## API Reference

### Tool: get_current_weather

**Parameters:**
- `city` (required): City name (e.g., "London", "Tokyo")
- `country` (optional): Country code (e.g., "US", "GB", "JP")

**Example:**
```json
{
  "city": "Paris",
  "country": "FR"
}
```

### Tool: get_weather_forecast

**Parameters:**
- `city` (required): City name
- `country` (optional): Country code
- `days` (optional): Number of forecast days (1-16, default: 7)

**Example:**
```json
{
  "city": "New York",
  "country": "US",
  "days": 5
}
```

### Tool: get_weather_alerts

**Parameters:**
- `city` (required): City name
- `country` (optional): Country code

**Example:**
```json
{
  "city": "Miami",
  "country": "US"
}
```

### Tool: get_growing_conditions

**Parameters:**
- `city` (required): City name
- `country` (optional): Country code
- `base_temp` (optional): Base temperature for GDD calculation in °C (default: 10)

**Example:**
```json
{
  "city": "Sacramento",
  "country": "US",
  "base_temp": 10
}
```

### Tool: get_historical_weather

**Parameters:**
- `city` (required): City name
- `month` (required): Month number (1-12, where 1=January, 12=December)
- `country` (optional): Country code
- `years_back` (optional): Number of years back to retrieve (1-10, default: 1)

**Example:**
```json
{
  "city": "London",
  "month": 7,
  "years_back": 5
}
```

## Data Source

This server uses the [Open-Meteo API](https://open-meteo.com/), which provides:
- Free access with no API key required
- High-quality weather data from multiple sources
- Historical weather archives
- Global coverage
- No rate limiting for reasonable use

## Technical Details

- **Protocol**: Model Context Protocol (MCP) via stdio
- **Language**: TypeScript with Node.js
- **Runtime**: Node.js 16+
- **Dependencies**:
  - `@modelcontextprotocol/sdk` - MCP framework
  - `zod` - Runtime type validation
- **APIs Used**:
  - Open-Meteo Forecast API
  - Open-Meteo Geocoding API
  - Open-Meteo Archive API (for historical data)

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly with `npm run test:inspector`
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

ISC License

## Support

For issues, questions, or contributions, please open an issue on the repository.

---

Built with the [Model Context Protocol](https://modelcontextprotocol.io/)
