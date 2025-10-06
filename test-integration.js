/**
 * Integration Test Script for Weather MCP HTTP Proxy
 * Tests all endpoints to verify the MCP server is working correctly
 */

const BASE_URL = 'http://localhost:3002';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, url, description) {
  try {
    log(`\n${name}`, 'cyan');
    log(`  ${description}`, 'reset');
    log(`  URL: ${url}`, 'blue');

    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    log(`  ✓ Success (${duration}ms)`, 'green');

    // Show relevant data snippet
    if (data.location) {
      log(`    Location: ${data.location}`, 'reset');
    }
    if (data.current?.temperature) {
      log(`    Temperature: ${data.current.temperature}`, 'reset');
    }
    if (data.current_conditions?.soil_temperature) {
      log(`    Soil Temp: ${data.current_conditions.soil_temperature}`, 'reset');
    }
    if (data.forecast) {
      log(`    Forecast Days: ${data.forecast.length}`, 'reset');
    }
    if (data.alerts) {
      log(`    Alerts: ${data.alerts.length} item(s)`, 'reset');
    }
    if (data.historical_data) {
      log(`    Historical Years: ${data.historical_data.length}`, 'reset');
    }

    return { success: true, duration, data };
  } catch (error) {
    log(`  ✗ Failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  Weather MCP Server Integration Tests', 'cyan');
  log('═══════════════════════════════════════════════════════════\n', 'cyan');

  // Test configuration
  const testCity = 'Manila';
  const testCountry = 'PH';
  const results = [];

  // Test 1: Health Check
  results.push(
    await testEndpoint(
      '1. Health Check',
      `${BASE_URL}/health`,
      'Verify the proxy server is running'
    )
  );

  // Test 2: API Documentation
  results.push(
    await testEndpoint(
      '2. API Documentation',
      `${BASE_URL}/`,
      'Get list of available endpoints'
    )
  );

  // Test 3: Current Weather
  results.push(
    await testEndpoint(
      '3. Current Weather',
      `${BASE_URL}/weather/current?city=${testCity}&country=${testCountry}`,
      `Get current weather for ${testCity}, ${testCountry}`
    )
  );

  // Test 4: Weather Forecast
  results.push(
    await testEndpoint(
      '4. Weather Forecast (7 days)',
      `${BASE_URL}/weather/forecast?city=${testCity}&days=7&country=${testCountry}`,
      `Get 7-day forecast for ${testCity}`
    )
  );

  // Test 5: Weather Alerts
  results.push(
    await testEndpoint(
      '5. Weather Alerts',
      `${BASE_URL}/weather/alerts?city=${testCity}&country=${testCountry}`,
      `Check weather warnings for ${testCity}`
    )
  );

  // Test 6: Growing Conditions (Key for agriculture!)
  results.push(
    await testEndpoint(
      '6. Growing Conditions 🌾',
      `${BASE_URL}/weather/growing?city=${testCity}&baseTemp=10&country=${testCountry}`,
      `Get agricultural data (GDD, soil metrics) for ${testCity}`
    )
  );

  // Test 7: Historical Weather
  const currentMonth = new Date().getMonth() + 1;
  results.push(
    await testEndpoint(
      '7. Historical Weather',
      `${BASE_URL}/weather/historical?city=${testCity}&month=${currentMonth}&yearsBack=2&country=${testCountry}`,
      `Get historical data for past 2 years`
    )
  );

  // Summary
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('  Test Summary', 'cyan');
  log('═══════════════════════════════════════════════════════════\n', 'cyan');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  log(`Total Tests: ${total}`, 'blue');
  log(`Passed: ${passed}`, passed === total ? 'green' : 'yellow');
  log(`Failed: ${failed}`, failed === 0 ? 'green' : 'red');

  if (passed === total) {
    log('\n✓ All tests passed! Your MCP server is ready to use.', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. Integrate with your Next.js app using the examples in INTEGRATION.md', 'reset');
    log('  2. Update your API routes to call these endpoints', 'reset');
    log('  3. Test with your agricultural monitoring UI', 'reset');
  } else {
    log('\n✗ Some tests failed. Please check the errors above.', 'red');
    log('\nTroubleshooting:', 'yellow');
    log('  - Make sure the proxy server is running: npm run proxy', 'reset');
    log('  - Check that port 3002 is not blocked', 'reset');
    log('  - Verify your internet connection (API calls external services)', 'reset');
  }

  log('');
  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is accessible before running tests
async function checkServer() {
  try {
    log('\nChecking if MCP HTTP Proxy is running...', 'yellow');
    const response = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      log('✓ Server is running\n', 'green');
      return true;
    }
  } catch (error) {
    log('\n✗ Cannot connect to MCP HTTP Proxy', 'red');
    log('\nPlease start the proxy server first:', 'yellow');
    log('  npm run proxy', 'cyan');
    log('\nThen run the tests again:', 'yellow');
    log('  npm test\n', 'cyan');
    process.exit(1);
  }
}

// Run tests
checkServer().then(() => runTests()).catch(console.error);
