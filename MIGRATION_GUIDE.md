# Weather MCP Server - Migration Guide

This guide helps you update the Weather MCP Server to use the latest dependencies and configurations.

## Quick Start

### Step 1: Backup Current Configuration
```bash
# Create backup of current files
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup
cp tsconfig.json tsconfig.json.backup
```

### Step 2: Update Dependencies

#### Option A: Conservative Update (Recommended)
Update only patch and minor versions first:
```bash
# Update MCP SDK (major update, test thoroughly)
npm install @modelcontextprotocol/sdk@^1.29.0

# Update dev dependencies (safe)
npm install --save-dev @types/node@^25.9.2 tsx@^4.22.4

# Keep TypeScript 5.x and Zod 3.x for now
```

#### Option B: Full Update (Requires More Testing)
```bash
# Replace package.json with package.updated.json
cp package.updated.json package.json

# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Step 3: Update TypeScript Configuration
```bash
# Use the updated TypeScript configuration
cp tsconfig.updated.json tsconfig.json

# Rebuild the project
npm run build
```

### Step 4: Test the Updates

Run the test suite to verify everything works:
```bash
# 1. Start the proxy server in one terminal
npm run proxy

# 2. In another terminal, run integration tests
npm test

# 3. Test with MCP Inspector
npm run test:inspector

# 4. Test SSE server
npm run dev:sse
# Open test-sse.html in a browser
```

## Breaking Changes to Watch For

### @modelcontextprotocol/sdk (1.18.2 → 1.29.0)
- Check the [SDK changelog](https://github.com/modelcontextprotocol/sdk-node/releases) for breaking changes
- Main areas to test:
  - Tool registration and schemas
  - Transport initialization
  - Error handling formats

### TypeScript Configuration Changes
- `Node16` → `NodeNext` module resolution may affect imports
- Add `.js` extensions to relative imports if needed:
  ```typescript
  // Before
  import { something } from "./module"

  // After (if needed)
  import { something } from "./module.js"
  ```

### Zod v4 Migration (If Upgrading)
Zod v4 has some breaking changes. If you upgrade:
- Review [Zod v4 migration guide](https://github.com/colinhacks/zod/blob/main/MIGRATION.md)
- Test all schema validations thoroughly
- Main changes affect error messages and some method names

## Rollback Plan

If issues occur after updating:
```bash
# Restore backup files
cp package.json.backup package.json
cp package-lock.json.backup package-lock.json
cp tsconfig.json.backup tsconfig.json

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild
npm run build
```

## Testing Checklist

After updates, verify:

- [ ] Project builds without errors (`npm run build`)
- [ ] Stdio transport works (`npm run dev`)
- [ ] SSE transport works (`npm run dev:sse`)
- [ ] HTTP proxy works (`npm run proxy`)
- [ ] Integration tests pass (`npm test`)
- [ ] MCP Inspector connects successfully
- [ ] All 6 weather tools function correctly:
  - [ ] get_current_weather
  - [ ] get_weather_forecast
  - [ ] get_weather_alerts
  - [ ] get_growing_conditions
  - [ ] get_historical_weather
  - [ ] get_hourly_weather

## Common Issues and Solutions

### Issue: Module resolution errors after TypeScript update
**Solution**: Add `.js` extensions to relative imports or keep using `Node16` module resolution

### Issue: Type errors with new @types/node
**Solution**: May need to update Node.js APIs usage. Check TypeScript errors for specifics.

### Issue: MCP SDK connection errors
**Solution**: Check SDK changelog for transport initialization changes

### Issue: Build output in wrong location
**Solution**: Verify `outDir` and `rootDir` in tsconfig.json

## Support

If you encounter issues:
1. Check the error messages carefully
2. Review the respective package changelogs
3. Test with the previous version to isolate the issue
4. Consider updating packages one at a time

## Next Steps After Migration

1. **Add Tests**: Consider adding unit tests with Vitest or Jest
2. **Setup CI/CD**: Add GitHub Actions for automated testing
3. **Improve Logging**: Replace console.log with winston or pino
4. **Add Monitoring**: Implement error tracking and performance monitoring

---
*Remember: Always test thoroughly in a development environment before deploying updates to production.*