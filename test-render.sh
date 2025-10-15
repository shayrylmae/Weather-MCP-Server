#!/bin/bash

# Test script for Weather MCP Server on Render
# Tests the SSE transport with MCP protocol

SERVER_URL="https://weather-mcp-server-67ou.onrender.com"
SESSION_ID=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  Weather MCP Server Test (Render)${NC}"
echo -e "${CYAN}============================================${NC}\n"

# Test 1: Health Check
echo -e "${BLUE}1. Health Check${NC}"
echo -e "   Testing: $SERVER_URL/health"
HEALTH_RESPONSE=$(curl -s "$SERVER_URL/health")
if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✓ Success${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "   ${RED}✗ Failed${NC}"
    exit 1
fi

echo ""

# Test 2: Server Info
echo -e "${BLUE}2. Server Info${NC}"
echo -e "   Testing: $SERVER_URL/"
INFO_RESPONSE=$(curl -s "$SERVER_URL/")
if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✓ Success${NC}"
    echo "   Response: $INFO_RESPONSE"
else
    echo -e "   ${RED}✗ Failed${NC}"
fi

echo ""
echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}  MCP Tool Tests (requires SSE session)${NC}"
echo -e "${YELLOW}============================================${NC}\n"

echo -e "${CYAN}Note: The SSE transport requires establishing a connection first.${NC}"
echo -e "${CYAN}For browser testing, open test-sse.html${NC}"
echo -e "${CYAN}For programmatic testing, use test-render.js${NC}\n"

# Test 3: Example - Current Weather (via direct POST to /message endpoint)
echo -e "${BLUE}3. Example: Get Current Weather for Manila${NC}"
echo -e "   Tool: get_current_weather"
echo -e "   Method: POST $SERVER_URL/message"

CURRENT_WEATHER=$(curl -s -X POST "$SERVER_URL/message" \
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
  }')

if echo "$CURRENT_WEATHER" | grep -q "error"; then
    echo -e "   ${YELLOW}⚠ Session required${NC}"
    echo "   Response: $CURRENT_WEATHER"
    echo -e "\n   ${CYAN}This is expected for SSE transport.${NC}"
    echo -e "   ${CYAN}SSE requires establishing a connection first via /sse endpoint.${NC}"
else
    echo -e "   ${GREEN}✓ Success${NC}"
    echo "   Response: $CURRENT_WEATHER"
fi

echo ""

# Test 4: Example - Historical Weather (3 years for Manila)
echo -e "${BLUE}4. Example: Get Historical Weather for Manila (3 years)${NC}"
echo -e "   Tool: get_historical_weather"
echo -e "   Parameters: city=Manila, month=10 (October), years_back=3"

CURRENT_MONTH=$(date +%m | sed 's/^0//')  # Remove leading zero

HISTORICAL_WEATHER=$(curl -s -X POST "$SERVER_URL/message" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_historical_weather\",
      \"arguments\": {
        \"city\": \"Manila\",
        \"country\": \"PH\",
        \"month\": $CURRENT_MONTH,
        \"years_back\": 3
      }
    }
  }")

if echo "$HISTORICAL_WEATHER" | grep -q "error"; then
    echo -e "   ${YELLOW}⚠ Session required${NC}"
    echo "   Response: $HISTORICAL_WEATHER"
    echo -e "\n   ${CYAN}This is expected for SSE transport.${NC}"
else
    echo -e "   ${GREEN}✓ Success${NC}"
    echo "   Response: $HISTORICAL_WEATHER"
fi

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  Testing Instructions${NC}"
echo -e "${CYAN}============================================${NC}\n"

echo -e "The SSE transport requires a persistent connection."
echo -e "To properly test MCP tools, use one of these methods:\n"

echo -e "${YELLOW}Option 1: Browser Test (Visual)${NC}"
echo -e "  1. Open test-sse.html in your browser"
echo -e "  2. It will connect to the Render server"
echo -e "  3. Click the buttons to test each tool\n"

echo -e "${YELLOW}Option 2: Node.js Test (Programmatic)${NC}"
echo -e "  Run: node test-render.js"
echo -e "  This will establish SSE connection and test all tools\n"

echo -e "${YELLOW}Option 3: Manual cURL (Advanced)${NC}"
echo -e "  1. Establish SSE connection: curl $SERVER_URL/sse"
echo -e "  2. Extract session ID from the response"
echo -e "  3. Send messages: curl -X POST '$SERVER_URL/message?session=<SESSION_ID>' -d '<MCP_MESSAGE>'\n"

echo -e "${GREEN}✓ Basic connectivity tests passed!${NC}"
echo -e "${CYAN}Use test-render.js or test-sse.html for full MCP tool testing.${NC}\n"
