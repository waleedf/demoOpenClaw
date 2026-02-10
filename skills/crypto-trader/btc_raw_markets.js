const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

function signRequest(method, path, timestamp) {
  const message = timestamp + method + path;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  return sign.sign(PRIVATE_KEY, 'base64');
}

function apiRequest(method, path) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signRequest(method, path, timestamp);
    
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
    req.end();
  });
}

async function main() {
  // Refresh BTC price
  const btcPrice = await new Promise((resolve) => {
    https.get('https://api.coinbase.com/v2/prices/BTC-USD/spot', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(parseFloat(JSON.parse(data).data?.amount));
        } catch (e) {
          resolve(69686);
        }
      });
    }).on('error', () => resolve(69686));
  });
  
  console.log(`Current BTC: $${btcPrice.toLocaleString()}\n`);
  
  const markets = await apiRequest('GET', '/trade-api/v2/markets?event_ticker=KXBTC-26FEB0817&limit=100');
  
  if (!markets.markets) {
    console.log('Error:', markets);
    return;
  }
  
  // Show raw market details
  console.log('=== RAW MARKET DATA (sorted by volume) ===\n');
  
  const sorted = markets.markets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  
  for (const m of sorted.slice(0, 25)) {
    console.log(`TICKER: ${m.ticker}`);
    console.log(`  Title: ${m.title || 'N/A'}`);
    console.log(`  Subtitle: ${m.subtitle || 'N/A'}`);
    console.log(`  YES: bid=${m.yes_bid} ask=${m.yes_ask}`);
    console.log(`  NO:  bid=${m.no_bid} ask=${m.no_ask}`);
    console.log(`  Volume: ${m.volume} | Open Interest: ${m.open_interest}`);
    console.log(`  Last: ${m.last_price} | Prev close: ${m.previous_yes_ask}`);
    console.log('');
  }
  
  // Find markets closest to current price
  console.log('\n=== FINDING MARKETS NEAR CURRENT PRICE ===');
  
  // Extract floor values from B buckets
  for (const m of sorted) {
    if (m.subtitle) {
      const match = m.subtitle.match(/\$?([\d,]+)/g);
      if (match) {
        const nums = match.map(s => parseFloat(s.replace(/[$,]/g, '')));
        console.log(`${m.ticker}: ${m.subtitle} -> extracted: ${nums.join(', ')}`);
      }
    }
  }
}

main().catch(console.error);
