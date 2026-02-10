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

function normcdf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function bucketProbability(currentPrice, lower, upper, volatility, hoursToExpiry) {
  const timeYears = hoursToExpiry / (24 * 365);
  const sigma = volatility * Math.sqrt(timeYears);
  const mu = -0.5 * sigma * sigma;
  const d_upper = (Math.log(upper / currentPrice) - mu) / sigma;
  const d_lower = (Math.log(lower / currentPrice) - mu) / sigma;
  return normcdf(d_upper) - normcdf(d_lower);
}

async function main() {
  const BTC_PRICE = 69680;
  const vol = 0.45; // Use 45% as middle ground
  
  // Check the earlier expiry event (0804)
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('CHECKING KXBTC-26FEB0804 (Closes Feb 8 @ 09:00 UTC - ~1hr away!)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const markets0804 = await apiRequest('GET', '/trade-api/v2/markets?event_ticker=KXBTC-26FEB0804&limit=100');
  
  if (markets0804.markets) {
    const closeTime = new Date(markets0804.markets[0].close_time);
    const now = new Date();
    const hoursToClose = Math.max(0.1, (closeTime - now) / (1000 * 60 * 60));
    
    console.log(`Time to close: ${hoursToClose.toFixed(2)} hours`);
    console.log(`BTC: $${BTC_PRICE.toLocaleString()}\n`);
    
    // Sort by volume
    const sorted = markets0804.markets
      .filter(m => m.volume > 0)
      .sort((a, b) => (b.volume || 0) - (a.volume || 0));
    
    console.log('Bucket   | Market Bid/Ask | Vol  | Fair (45%v) | Edge');
    console.log('---------|----------------|------|-------------|------');
    
    for (const m of sorted.slice(0, 10)) {
      // Parse bucket range from subtitle
      const match = m.subtitle?.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
      if (!match) continue;
      
      const lower = parseFloat(match[1].replace(/,/g, ''));
      const upper = parseFloat(match[2].replace(/,/g, ''));
      
      const fairProb = bucketProbability(BTC_PRICE, lower, upper, vol, hoursToClose);
      const marketAsk = m.yes_ask / 100;
      const marketBid = m.yes_bid / 100;
      const edge = fairProb - marketAsk;
      
      const current = (BTC_PRICE >= lower && BTC_PRICE < upper) ? '→' : ' ';
      const signal = edge > 0.05 ? '🟢' : (edge < -0.05 ? '🔴' : '');
      
      console.log(
        `${current}${m.ticker.split('-')[2].padEnd(7)} | ` +
        `${(marketBid*100).toFixed(0).padStart(2)}¢ / ${(marketAsk*100).toFixed(0).padStart(2)}¢       | ` +
        `${String(m.volume).padStart(4)} | ` +
        `${(fairProb*100).toFixed(1).padStart(5)}%      | ${(edge*100).toFixed(1).padStart(5)}% ${signal}`
      );
    }
  }
  
  // Check for mispriced tail buckets in 0817
  console.log('\n\n═══════════════════════════════════════════════════════════════════');
  console.log('TAIL ANALYSIS - KXBTC-26FEB0817 (Closes in 13.8 hrs)');
  console.log('Looking for mispriced far-from-money buckets');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const markets0817 = await apiRequest('GET', '/trade-api/v2/markets?event_ticker=KXBTC-26FEB0817&limit=100');
  
  if (markets0817.markets) {
    const hoursToClose = 13.8;
    
    // Find extreme buckets
    const parsed = markets0817.markets.map(m => {
      const match = m.subtitle?.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
      const aboveMatch = m.subtitle?.match(/\$([\d,]+(?:\.\d+)?)\s+or\s+above/);
      const belowMatch = m.subtitle?.match(/\$([\d,]+(?:\.\d+)?)\s+or\s+below/);
      
      if (match) {
        return {
          ...m,
          type: 'bucket',
          lower: parseFloat(match[1].replace(/,/g, '')),
          upper: parseFloat(match[2].replace(/,/g, ''))
        };
      } else if (aboveMatch) {
        return { ...m, type: 'above', threshold: parseFloat(aboveMatch[1].replace(/,/g, '')) };
      } else if (belowMatch) {
        return { ...m, type: 'below', threshold: parseFloat(belowMatch[1].replace(/,/g, '')) };
      }
      return null;
    }).filter(Boolean);
    
    // Far OTM puts (below $66k) - check if NO is underpriced
    console.log('FAR DOWN BUCKETS (potential cheap NO):');
    const farDown = parsed.filter(m => m.type === 'bucket' && m.upper < 66500).slice(0, 5);
    
    for (const m of farDown) {
      const fairProb = bucketProbability(BTC_PRICE, m.lower, m.upper, vol, hoursToClose);
      const noBid = m.no_bid / 100;
      const noAsk = m.no_ask / 100;
      const noFair = 1 - fairProb;
      const edgeNo = noFair - noAsk; // Edge if we buy NO
      
      console.log(`${m.ticker.split('-')[2]}: NO fair=${(noFair*100).toFixed(1)}% ask=${(noAsk*100).toFixed(0)}¢ → edge=${(edgeNo*100).toFixed(1)}%`);
    }
    
    // Far OTM calls (above $74k)
    console.log('\nFAR UP BUCKETS (potential cheap NO):');
    const farUp = parsed.filter(m => m.type === 'bucket' && m.lower > 73500).slice(0, 5);
    
    for (const m of farUp) {
      const fairProb = bucketProbability(BTC_PRICE, m.lower, m.upper, vol, hoursToClose);
      const noFair = 1 - fairProb;
      const noAsk = m.no_ask / 100;
      const edgeNo = noFair - noAsk;
      
      console.log(`${m.ticker.split('-')[2]}: NO fair=${(noFair*100).toFixed(1)}% ask=${(noAsk*100).toFixed(0)}¢ → edge=${(edgeNo*100).toFixed(1)}%`);
    }
    
    // Check threshold markets
    console.log('\nTHRESHOLD MARKETS:');
    const thresholds = parsed.filter(m => m.type === 'above' || m.type === 'below');
    for (const m of thresholds) {
      const timeYears = hoursToClose / (24 * 365);
      const sigma = vol * Math.sqrt(timeYears);
      const mu = -0.5 * sigma * sigma;
      
      let fairProb;
      if (m.type === 'above') {
        const d = (Math.log(m.threshold / BTC_PRICE) - mu) / sigma;
        fairProb = 1 - normcdf(d);
      } else {
        const d = (Math.log(m.threshold / BTC_PRICE) - mu) / sigma;
        fairProb = normcdf(d);
      }
      
      const yesBid = m.yes_bid / 100;
      const yesAsk = m.yes_ask / 100;
      const edge = fairProb - yesAsk;
      
      console.log(`${m.subtitle}: YES fair=${(fairProb*100).toFixed(2)}% ask=${(yesAsk*100).toFixed(0)}¢ → edge=${(edge*100).toFixed(1)}%`);
    }
  }
}

main().catch(console.error);
