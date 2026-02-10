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
  // Get all KXBTC markets
  console.log('=== FETCHING KXBTC MARKETS ===\n');
  
  const markets = await apiRequest('GET', '/trade-api/v2/markets?series_ticker=KXBTC&status=open&limit=100');
  
  if (markets.markets && markets.markets.length > 0) {
    console.log(`Found ${markets.markets.length} open BTC markets\n`);
    
    // Group by event
    const byEvent = {};
    for (const m of markets.markets) {
      if (!byEvent[m.event_ticker]) byEvent[m.event_ticker] = [];
      byEvent[m.event_ticker].push(m);
    }
    
    for (const [event, eventMarkets] of Object.entries(byEvent)) {
      console.log(`\n=== EVENT: ${event} ===`);
      console.log(`Markets: ${eventMarkets.length}`);
      
      // Show first market's details
      const sample = eventMarkets[0];
      console.log(`Close time: ${sample.close_time}`);
      console.log(`Expiration: ${sample.expiration_time}`);
      
      // Get current BTC price for reference
      console.log('\nMarket strikes and prices:');
      
      // Sort by some threshold value
      const sorted = eventMarkets.sort((a, b) => {
        const aMatch = a.ticker.match(/T(\d+)/);
        const bMatch = b.ticker.match(/T(\d+)/);
        if (aMatch && bMatch) return parseFloat(aMatch[1]) - parseFloat(bMatch[1]);
        return 0;
      });
      
      for (const m of sorted.slice(0, 20)) { // Show top 20
        const yesAsk = m.yes_ask ? (m.yes_ask / 100).toFixed(2) : 'N/A';
        const yesBid = m.yes_bid ? (m.yes_bid / 100).toFixed(2) : 'N/A';
        const noAsk = m.no_ask ? (m.no_ask / 100).toFixed(2) : 'N/A';
        const noBid = m.no_bid ? (m.no_bid / 100).toFixed(2) : 'N/A';
        const volume = m.volume || 0;
        
        // Extract strike from ticker
        let strike = m.ticker;
        const tMatch = m.ticker.match(/T(\d+\.?\d*)/);
        const bMatch = m.ticker.match(/B(\d+\.?\d*)/);
        if (tMatch) strike = `Above $${parseFloat(tMatch[1]).toLocaleString()}`;
        else if (bMatch) strike = `Between $${parseFloat(bMatch[1]).toLocaleString()}`;
        
        console.log(`${m.ticker}`);
        console.log(`  ${strike}`);
        console.log(`  YES: ${yesBid}/${yesAsk} | NO: ${noBid}/${noAsk} | Vol: ${volume}`);
      }
    }
  } else {
    console.log('No markets found or error:', JSON.stringify(markets, null, 2));
  }
  
  // Also get current BTC price from external source
  console.log('\n\n=== GETTING CURRENT BTC PRICE ===');
  const btcPrice = await new Promise((resolve) => {
    https.get('https://api.coinbase.com/v2/prices/BTC-USD/spot', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data?.amount || 'unknown');
        } catch (e) {
          resolve('error');
        }
      });
    }).on('error', () => resolve('error'));
  });
  console.log(`Current BTC/USD: $${parseFloat(btcPrice).toLocaleString()}`);
}

main().catch(console.error);
