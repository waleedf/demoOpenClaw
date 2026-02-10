const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

function signRequest(method, path, timestamp, body = '') {
  const message = timestamp + method + path + body;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  return sign.sign(PRIVATE_KEY, 'base64');
}

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = signRequest(method, path, timestamp, bodyStr);
    
    const options = {
      hostname: 'api.elections.kalshi.com',
      path: path,
      method: method,
      headers: {
        'KALSHI-ACCESS-KEY': API_KEY_ID,
        'KALSHI-ACCESS-SIGNATURE': signature,
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // Try different balance endpoints
  console.log('=== CHECKING BALANCE ===\n');
  
  // Try v2 portfolio
  const balance1 = await apiRequest('GET', '/trade-api/v2/portfolio/balance');
  console.log('v2/portfolio/balance:', JSON.stringify(balance1, null, 2));
  
  // Also check positions
  const positions = await apiRequest('GET', '/trade-api/v2/portfolio/positions');
  console.log('\nPositions:', JSON.stringify(positions, null, 2));
  
  // Check fills (recent trades)
  const fills = await apiRequest('GET', '/trade-api/v2/portfolio/fills?limit=5');
  console.log('\nRecent fills:', JSON.stringify(fills, null, 2));
  
  // Check if trading is enabled for this account
  console.log('\n=== CHECKING TRADING STATUS ===');
  
  // Try to get exchange status
  const status = await apiRequest('GET', '/trade-api/v2/exchange/status');
  console.log('Exchange status:', JSON.stringify(status, null, 2));
}

main().catch(console.error);
