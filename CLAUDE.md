# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a weather MCP (Model Context Protocol) server built with TypeScript that provides real-time and historical weather data using the Open-Meteo API. The project supports multiple transport modes (stdio, SSE, HTTP Proxy) and uses the `@modelcontextprotocol/sdk` for MCP functionality and Zod for schema validation.

## Architecture

- **Language**: TypeScript with Node.js
- **Main Dependencies**:
  - `@modelcontextprotocol/sdk`: Core MCP framework (^1.18.2)
  - `zod`: Runtime type validation and schema definition (^3.25.76)
- **Development Tools**:
  - `tsx`: TypeScript execution for development (^4.20.6)
  - `typescript`: TypeScript compiler (^5.9.3)
  - `@types/node`: Node.js type definitions (^24.6.1)

## Project Structure

```
weather-mcp-server/
├── src/                           # Source code
│   ├── index.ts                   # Main MCP server (stdio transport)
│   ├── sse-server.ts             # SSE transport server (modified)
│   ├── sse-server-fixed.ts       # SSE server variant (untracked)
│   └── sse-server-with-routing.ts # SSE server variant (untracked)
├── dist/                          # Compiled output
│   ├── index.js                   # Compiled stdio server
│   └── sse-server.js             # Compiled SSE server
├── http-proxy.js                  # HTTP proxy wrapper (11KB)
├── test-integration.js            # Integration test suite
├── test-sse.html                  # SSE transport test page
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── CLAUDE.md                      # This file
├── INTEGRATION.md                 # Next.js integration guide
├── IMPROVEMENTS.md                # Detailed improvements documentation
├── CHANGELOG.md                   # Change log
└── README.md                      # User-facing documentation
```

## Transport Modes

The server supports three different transport modes:

### 1. **Stdio Transport** (src/index.ts)
- Original MCP transport over stdin/stdout
- Used by Claude Desktop and MCP Inspector
- Run with: `npm run dev` or `npm start`

### 2. **SSE Transport** (src/sse-server.ts) ⭐
- Server-Sent Events transport with message routing
- Persistent stateful connections over HTTP
- Connection registry with automatic cleanup
- Session-based message routing
- Run with: `npm run dev:sse` or `npm run start:sse` (port 3003)

### 3. **HTTP Proxy** (http-proxy.js)
- Simple request-response HTTP wrapper
- REST API for quick testing
- No persistent connection required
- Run with: `npm run proxy` (port 3002)

## Development Commands

### Building and Running
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run stdio transport in development mode
- `npm run dev:sse` - Run SSE transport in development mode (port 3003)
- `npm start` - Run compiled stdio transport
- `npm run start:sse` - Run compiled SSE transport (port 3003)
- `npm run proxy` - Build and start HTTP proxy server (port 3002)

### Testing
- `npm test` - Run integration tests (requires proxy to be running)
- `npm run test:inspector` - Test with MCP Inspector (interactive UI)
- `npm run test:manual` - Run manual tests

### Development Workflow
1. Edit source files in the `src/` directory
2. Use `npx tsx` for quick development and testing
3. Build with `npm run build` for production
4. Test with `npm run test:inspector` or `npm test`

## TypeScript Configuration

The project uses ES2022 target with Node16 module resolution. Source files go in `src/` and compiled output goes to `dist/`. The module system is set to ES modules (`"type": "module"` in package.json).

## MCP Server Development

This project implements an MCP server for weather data with 5 main tools:

### Available Tools
1. **get_current_weather** - Real-time weather conditions
2. **get_weather_forecast** - Multi-day forecasts (1-16 days)
3. **get_weather_alerts** - Weather warnings and alerts
4. **get_growing_conditions** - Agricultural/gardening data (GDD, soil metrics)
5. **get_historical_weather** - Historical weather statistics

### Development Guidelines

When adding new functionality:

1. **Schema Validation**: Use Zod schemas for all data validation
2. **MCP Patterns**: Follow MCP SDK patterns for server implementation
3. **Error Handling**: Implement proper error handling for weather API calls
4. **Type Safety**: Use TypeScript strict mode features
5. **Transport Compatibility**: Ensure new tools work across all transport modes
6. **API Integration**: Use Open-Meteo API endpoints appropriately

### Key Implementation Details

- **Geocoding**: All tools use the Open-Meteo Geocoding API to convert city names to coordinates
- **Weather Codes**: Mapped from numeric codes to human-readable descriptions (WEATHER_CODES object)
- **SSE Connection Management**: The SSE server uses a ConnectionRegistry class to manage sessions
- **Error Responses**: All tools return structured error messages using the MCP error format

### File Modification Notes

- **src/sse-server.ts**: Currently modified (uncommitted changes)
- **src/sse-server-fixed.ts**: Untracked variant (not in git)
- **src/sse-server-with-routing.ts**: Untracked variant (not in git)

### API Endpoints Used

- **Geocoding**: `https://geocoding-api.open-meteo.com/v1/search`
- **Current Weather & Forecast**: `https://api.open-meteo.com/v1/forecast`
- **Historical Data**: `https://archive-api.open-meteo.com/v1/archive`

## Integration

See INTEGRATION.md for detailed instructions on integrating this server with Next.js applications or other MCP clients.