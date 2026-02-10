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
  // Fresh BTC price
  const btcPrice = await new Promise((resolve) => {
    https.get('https://api.coinbase.com/v2/prices/BTC-USD/spot', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(parseFloat(JSON.parse(data).data?.amount));
        } catch (e) {
          resolve(69680);
        }
      });
    }).on('error', () => resolve(69680));
  });
  
  console.log(`Fresh BTC price: $${btcPrice.toLocaleString()}\n`);
  
  // Get specific market details
  const ticker1 = 'KXBTC-26FEB0804-B69875';
  const ticker2 = 'KXBTC-26FEB0804-B70125';
  
  const market1 = await apiRequest('GET', `/trade-api/v2/markets/${ticker1}`);
  const market2 = await apiRequest('GET', `/trade-api/v2/markets/${ticker2}`);
  
  console.log('=== B69875 ($69,750 - $70,000) ===');
  if (market1.market) {
    const m = market1.market;
    console.log(`Status: ${m.status}`);
    console.log(`Close time: ${m.close_time}`);
    console.log(`YES bid/ask: ${m.yes_bid}¢ / ${m.yes_ask}¢`);
    console.log(`NO bid/ask: ${m.no_bid}¢ / ${m.no_ask}¢`);
    console.log(`Volume: ${m.volume}`);
    console.log(`Open Interest: ${m.open_interest}`);
    console.log(`Subtitle: ${m.subtitle}`);
  } else {
    console.log('Error:', market1);
  }
  
  console.log('\n=== B70125 ($70,000 - $70,250) ===');
  if (market2.market) {
    const m = market2.market;
    console.log(`Status: ${m.status}`);
    console.log(`Close time: ${m.close_time}`);
    console.log(`YES bid/ask: ${m.yes_bid}¢ / ${m.yes_ask}¢`);
    console.log(`NO bid/ask: ${m.no_bid}¢ / ${m.no_ask}¢`);
    console.log(`Volume: ${m.volume}`);
    console.log(`Open Interest: ${m.open_interest}`);
    console.log(`Subtitle: ${m.subtitle}`);
  } else {
    console.log('Error:', market2);
  }
  
  // Get order book
  console.log('\n=== ORDER BOOK B69875 ===');
  const book1 = await apiRequest('GET', `/trade-api/v2/markets/${ticker1}/orderbook`);
  if (book1.orderbook) {
    console.log('YES bids:', JSON.stringify(book1.orderbook.yes?.slice(0, 5)));
    console.log('NO bids:', JSON.stringify(book1.orderbook.no?.slice(0, 5)));
  }
  
  // Check account
  console.log('\n=== ACCOUNT STATUS ===');
  const balance = await apiRequest('GET', '/trade-api/v2/portfolio/balance');
  console.log('Balance:', JSON.stringify(balance, null, 2));
  
  // Time check
  const now = new Date();
  const closeTime = new Date('2026-02-08T09:00:00Z');
  const minutesLeft = (closeTime - now) / (1000 * 60);
  
  console.log(`\nTime now: ${now.toISOString()}`);
  console.log(`Market closes: ${closeTime.toISOString()}`);
  console.log(`Minutes remaining: ${minutesLeft.toFixed(1)}`);
  
  if (minutesLeft < 30) {
    console.log('\n⚠️ WARNING: Less than 30 minutes to close - high risk short-term trade');
  }
  
  // Position sizing
  console.log('\n=== POSITION SIZING (per playbook) ===');
  const availableBalance = balance.balance?.available_balance_cents / 100 || 19.37;
  const maxPosition = availableBalance * 0.05; // 5% max per trade
  const askPrice = market1.market?.yes_ask / 100 || 0.17;
  const maxContracts = Math.floor(maxPosition / askPrice);
  
  console.log(`Available: $${availableBalance.toFixed(2)}`);
  console.log(`Max position (5%): $${maxPosition.toFixed(2)}`);
  console.log(`At ${(askPrice*100).toFixed(0)}¢ ask: ${maxContracts} contracts max`);
  console.log(`Total risk: $${(maxContracts * askPrice).toFixed(2)}`);
  console.log(`Max profit if YES wins: $${(maxContracts * (1 - askPrice)).toFixed(2)}`);
}

main().catch(console.error);
