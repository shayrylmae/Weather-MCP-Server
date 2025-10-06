# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a weather MCP (Model Context Protocol) server built with TypeScript. The project uses the `@modelcontextprotocol/sdk` for MCP functionality and Zod for schema validation.

## Architecture

- **Language**: TypeScript with Node.js
- **Main Dependencies**:
  - `@modelcontextprotocol/sdk`: Core MCP framework
  - `zod`: Runtime type validation and schema definition
- **Development Tools**:
  - `tsx`: TypeScript execution for development
  - `typescript`: TypeScript compiler

## Project Structure

```
weather-mcp-server/
├── src/           # Source code (when created)
├── dist/          # Compiled output
├── package.json   # Dependencies and scripts
└── tsconfig.json  # TypeScript configuration
```

## Development Commands

### Building and Running
- `npx tsc` - Compile TypeScript to JavaScript
- `npx tsx src/index.ts` - Run TypeScript directly (development)
- `node dist/index.js` - Run compiled JavaScript

### Development Workflow
1. Create source files in the `src/` directory
2. Use `npx tsx` for quick development and testing
3. Build with `npx tsc` for production

## TypeScript Configuration

The project uses ES2022 target with Node16 module resolution. Source files go in `src/` and compiled output goes to `dist/`.

## MCP Server Development

This project implements an MCP server for weather data. When adding new functionality:

1. Use Zod schemas for all data validation
2. Follow MCP SDK patterns for server implementation
3. Implement proper error handling for weather API calls
4. Use TypeScript strict mode features