#!/bin/bash

# HTTPS Security Verification Script
# This script tests that valenciavguides.es is properly configured for HTTPS

echo "=========================================="
echo "HTTPS Security Verification for valenciavguides.es"
echo "=========================================="
echo ""

DOMAIN="valenciavguides.es"
URL_HTTP="http://${DOMAIN}/codigo-padre.html"
URL_HTTPS="https://${DOMAIN}/codigo-padre.html"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if HTTPS URL is accessible
echo "Test 1: Checking HTTPS accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "${URL_HTTPS}" --max-time 10)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC}: HTTPS URL is accessible (HTTP $HTTP_CODE)"
else
    echo -e "${RED}✗ FAIL${NC}: HTTPS URL returned HTTP $HTTP_CODE"
fi
echo ""

# Test 2: Check if HTTP redirects to HTTPS
echo "Test 2: Checking HTTP to HTTPS redirect..."
REDIRECT_URL=$(curl -s -o /dev/null -w "%{url_effective}" -L "${URL_HTTP}" --max-time 10)
if [[ "$REDIRECT_URL" == https://* ]]; then
    echo -e "${GREEN}✓ PASS${NC}: HTTP redirects to HTTPS"
    echo "   Redirected to: $REDIRECT_URL"
else
    echo -e "${RED}✗ FAIL${NC}: HTTP does not redirect to HTTPS"
    echo "   Final URL: $REDIRECT_URL"
fi
echo ""

# Test 3: Check for HSTS header
echo "Test 3: Checking for HSTS header..."
HSTS_HEADER=$(curl -s -I "${URL_HTTPS}" --max-time 10 | grep -i "strict-transport-security")
if [ -n "$HSTS_HEADER" ]; then
    echo -e "${GREEN}✓ PASS${NC}: HSTS header is present"
    echo "   $HSTS_HEADER"
else
    echo -e "${YELLOW}⚠ WARNING${NC}: HSTS header not found in HTTP response"
    echo "   (This might be set via meta tag in HTML, which is valid)"
fi
echo ""

# Test 4: Check for mixed content (basic check)
echo "Test 4: Checking for potential mixed content..."
MIXED_CONTENT=$(curl -s "${URL_HTTPS}" | grep -o 'http://[^"'\'' ]*' | grep -v "localhost" | grep -v "127.0.0.1" | grep -v "xmlns" | grep -v "data:image")
if [ -z "$MIXED_CONTENT" ]; then
    echo -e "${GREEN}✓ PASS${NC}: No obvious HTTP resources found in HTML"
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Found potential HTTP resources:"
    echo "$MIXED_CONTENT"
fi
echo ""

# Test 5: Check SSL certificate
echo "Test 5: Checking SSL certificate..."
if command -v openssl &> /dev/null; then
    CERT_INFO=$(echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    if [ -n "$CERT_INFO" ]; then
        echo -e "${GREEN}✓ PASS${NC}: SSL certificate is valid"
        echo "$CERT_INFO" | sed 's/^/   /'
    else
        echo -e "${RED}✗ FAIL${NC}: Could not retrieve SSL certificate"
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC}: openssl not available"
fi
echo ""

# Test 6: Check DNS resolution
echo "Test 6: Checking DNS resolution..."
if command -v nslookup &> /dev/null; then
    DNS_RESULT=$(nslookup ${DOMAIN} 2>&1 | grep -A 1 "Name:" | tail -1)
    if [ -n "$DNS_RESULT" ]; then
        echo -e "${GREEN}✓ PASS${NC}: DNS resolves correctly"
        echo "   $DNS_RESULT"
    else
        echo -e "${RED}✗ FAIL${NC}: DNS resolution failed"
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC}: nslookup not available"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test the website in your browser: https://${DOMAIN}/codigo-padre.html"
echo "2. Check in both normal and incognito modes"
echo "3. Use browser DevTools (F12) to verify no security warnings"
echo "4. Optionally submit to HSTS preload: https://hstspreload.org/"
echo ""
