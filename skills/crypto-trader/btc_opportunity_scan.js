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
  const BTC_PRICE = 69686;
  
  // Get the Feb 8 17:00 event markets (the one with liquidity)
  console.log('=== KXBTC-26FEB0817 DETAILED ANALYSIS ===');
  console.log(`Current BTC: $${BTC_PRICE.toLocaleString()}\n`);
  
  const markets = await apiRequest('GET', '/trade-api/v2/markets?event_ticker=KXBTC-26FEB0817&limit=100');
  
  if (!markets.markets) {
    console.log('Error:', markets);
    return;
  }
  
  // Parse all markets
  const parsed = markets.markets.map(m => {
    const ticker = m.ticker;
    let type, lower, upper;
    
    // T = threshold (above X)
    const tMatch = ticker.match(/T(\d+\.?\d*)/);
    if (tMatch) {
      type = 'above';
      lower = parseFloat(tMatch[1]);
      upper = Infinity;
    }
    
    // B = between/bucket
    const bMatch = ticker.match(/B(\d+)/);
    if (bMatch) {
      // Buckets are $500 wide centered on the number
      const center = parseFloat(bMatch[1]);
      type = 'bucket';
      lower = center - 250;
      upper = center + 250;
    }
    
    return {
      ticker: m.ticker,
      type,
      lower,
      upper,
      yesBid: m.yes_bid ? m.yes_bid / 100 : null,
      yesAsk: m.yes_ask ? m.yes_ask / 100 : null,
      noBid: m.no_bid ? m.no_bid / 100 : null,
      noAsk: m.no_ask ? m.no_ask / 100 : null,
      volume: m.volume || 0,
      openInterest: m.open_interest || 0,
      lastPrice: m.last_price ? m.last_price / 100 : null,
      subtitle: m.subtitle,
      closeTime: m.close_time
    };
  });
  
  // Focus on buckets near current price
  const nearBuckets = parsed
    .filter(m => m.type === 'bucket' && m.lower >= BTC_PRICE - 5000 && m.upper <= BTC_PRICE + 5000)
    .sort((a, b) => a.lower - b.lower);
  
  console.log('=== BUCKETS NEAR CURRENT PRICE ===\n');
  console.log('BTC currently at $69,686 → falls in $69,500-$70,000 bucket\n');
  
  console.log('Bucket         | Range            | YES Bid/Ask | NO Bid/Ask  | Volume | OI');
  console.log('---------------|------------------|-------------|-------------|--------|----');
  
  for (const m of nearBuckets) {
    const range = `$${m.lower.toLocaleString()}-$${m.upper.toLocaleString()}`;
    const yesBidAsk = `${m.yesBid?.toFixed(2) || ' N/A'}/${m.yesAsk?.toFixed(2) || 'N/A'}`;
    const noBidAsk = `${m.noBid?.toFixed(2) || ' N/A'}/${m.noAsk?.toFixed(2) || 'N/A'}`;
    
    // Mark the bucket BTC is currently in
    const current = (BTC_PRICE >= m.lower && BTC_PRICE < m.upper) ? '**' : '  ';
    
    console.log(`${current}${m.ticker.split('-')[2].padEnd(13)} | ${range.padEnd(16)} | ${yesBidAsk.padEnd(11)} | ${noBidAsk.padEnd(11)} | ${String(m.volume).padStart(6)} | ${m.openInterest}`);
  }
  
  // Find threshold markets for hedging/analysis
  console.log('\n\n=== THRESHOLD MARKETS (Above X) ===\n');
  const thresholds = parsed
    .filter(m => m.type === 'above' && m.lower >= BTC_PRICE - 5000 && m.lower <= BTC_PRICE + 5000)
    .sort((a, b) => a.lower - b.lower);
    
  for (const m of thresholds) {
    const yesBidAsk = `${m.yesBid?.toFixed(2) || ' N/A'}/${m.yesAsk?.toFixed(2) || 'N/A'}`;
    console.log(`Above $${m.lower.toLocaleString()}: YES ${yesBidAsk} | Vol: ${m.volume}`);
  }
  
  // Market timing
  const closeTime = new Date(parsed[0].closeTime);
  const now = new Date();
  const hoursToClose = (closeTime - now) / (1000 * 60 * 60);
  
  console.log(`\n\n=== TIMING ===`);
  console.log(`Market closes: ${closeTime.toISOString()}`);
  console.log(`Hours until close: ${hoursToClose.toFixed(1)}`);
  console.log(`Current time: ${now.toISOString()}`);
  
  // Look for opportunities
  console.log('\n\n=== OPPORTUNITY ANALYSIS ===');
  
  // The current bucket ($69,500-$70,000) 
  const currentBucket = nearBuckets.find(m => BTC_PRICE >= m.lower && BTC_PRICE < m.upper);
  if (currentBucket) {
    console.log(`\nCurrent bucket: ${currentBucket.ticker}`);
    console.log(`  YES ask: ${currentBucket.yesAsk} (cost to bet BTC stays in this range)`);
    console.log(`  YES bid: ${currentBucket.yesBid} (can sell at this if holding)`);
    console.log(`  Volume: ${currentBucket.volume}`);
    
    // Simple vol estimate: BTC daily volatility ~3-4%
    // In ~20 hours, expected move = price * volatility * sqrt(time)
    // 69686 * 0.035 * sqrt(20/24) ≈ $2,200
    const expectedMove = BTC_PRICE * 0.035 * Math.sqrt(hoursToClose / 24);
    console.log(`\nExpected move (3.5% daily vol): ±$${expectedMove.toFixed(0)}`);
    
    // Probability of staying in $500 bucket is low
    // Using normal distribution approximation
    const bucketWidth = 500;
    const sigma = expectedMove / 1.645; // 90% CI
    const stayProb = 0.5 * (1 - 2 * (1 - normcdf((BTC_PRICE - currentBucket.lower) / sigma)));
    
    console.log(`Rough probability BTC stays in current bucket: ~${(bucketWidth / (2 * expectedMove) * 100).toFixed(0)}%`);
  }
}

function normcdf(x) {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

main().catch(console.error);
