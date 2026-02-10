#!/usr/bin/env node
/**
 * BTC Kalshi Trading - Properly signed
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const BASE_URL = 'api.elections.kalshi.com';
const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY_PATH = '/data/workspace/.keys/kalshi_private_key.pem';
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

function signRequest(timestampMs, method, path, body = '') {
    const message = `${timestampMs}${method}${path}${body}`;
    const signature = crypto.sign('sha256', Buffer.from(message), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
    });
    return signature.toString('base64');
}

function makeRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const body = data ? JSON.stringify(data) : '';
        const signature = signRequest(timestampMs, method, path, body);
        
        const options = {
            hostname: BASE_URL,
            port: 443,
            path: path,
            method: method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(responseData) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });
        
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// Probability calculation
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

async function getBTCPrice() {
  return new Promise((resolve) => {
    https.get('https://api.coinbase.com/v2/prices/BTC-USD/spot', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(parseFloat(JSON.parse(data).data?.amount));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('BTC KALSHI TRADING ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const btcPrice = await getBTCPrice();
  console.log(`BTC Price: $${btcPrice?.toLocaleString() || 'unknown'}\n`);
  
  // Get account balance
  const balanceRes = await makeRequest('GET', '/portfolio/balance');
  const balance = balanceRes.data.balance / 100;
  console.log(`Account Balance: $${balance.toFixed(2)}`);
  console.log(`Max Position (5%): $${(balance * 0.05).toFixed(2)}\n`);
  
  // Check 0804 event (closes soon)
  console.log('─── KXBTC-26FEB0804 (Closes ~09:00 UTC) ───\n');
  
  const marketsRes = await makeRequest('GET', '/markets?event_ticker=KXBTC-26FEB0804&limit=100');
  
  if (marketsRes.status === 200 && marketsRes.data.markets) {
    const markets = marketsRes.data.markets;
    const closeTime = new Date(markets[0].close_time);
    const now = new Date();
    const hoursToClose = Math.max(0.05, (closeTime - now) / (1000 * 60 * 60));
    
    console.log(`Time to close: ${(hoursToClose * 60).toFixed(0)} minutes`);
    console.log(`Markets found: ${markets.length}\n`);
    
    // Analyze buckets with liquidity
    const opportunities = [];
    const vol = 0.45; // 45% annualized
    
    for (const m of markets) {
      if (!m.subtitle) continue;
      const match = m.subtitle.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
      if (!match) continue;
      
      const lower = parseFloat(match[1].replace(/,/g, ''));
      const upper = parseFloat(match[2].replace(/,/g, ''));
      
      const fairProb = bucketProbability(btcPrice, lower, upper, vol, hoursToClose);
      const marketAsk = m.yes_ask / 100;
      const marketBid = m.yes_bid / 100;
      const edge = fairProb - marketAsk;
      
      const current = (btcPrice >= lower && btcPrice < upper);
      
      opportunities.push({
        ticker: m.ticker,
        lower, upper,
        fairProb,
        marketAsk,
        marketBid,
        edge,
        volume: m.volume,
        current,
        subtitle: m.subtitle
      });
    }
    
    // Sort by edge
    opportunities.sort((a, b) => b.edge - a.edge);
    
    console.log('TOP OPPORTUNITIES (by edge):\n');
    console.log('Bucket          | Range                | Fair   | Ask  | Edge  | Vol');
    console.log('----------------|----------------------|--------|------|-------|-----');
    
    for (const o of opportunities.slice(0, 10)) {
      const mark = o.current ? '→' : ' ';
      const signal = o.edge > 0.05 ? '🟢' : (o.edge < -0.05 ? '🔴' : '');
      console.log(
        `${mark}${o.ticker.split('-')[2].padEnd(14)} | $${o.lower.toLocaleString()}-$${o.upper.toLocaleString().padEnd(6)} | ${(o.fairProb*100).toFixed(1).padStart(5)}% | ${(o.marketAsk*100).toFixed(0).padStart(3)}¢ | ${(o.edge*100).toFixed(1).padStart(5)}% | ${o.volume} ${signal}`
      );
    }
    
    // Best opportunity
    const best = opportunities[0];
    if (best && best.edge > 0.05) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('🟢 RECOMMENDED TRADE');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`Ticker: ${best.ticker}`);
      console.log(`Range: ${best.subtitle}`);
      console.log(`Fair Value: ${(best.fairProb * 100).toFixed(1)}%`);
      console.log(`Market Ask: ${(best.marketAsk * 100).toFixed(0)}¢`);
      console.log(`Edge: ${(best.edge * 100).toFixed(1)}%`);
      
      const maxSpend = balance * 0.05;
      const contracts = Math.floor(maxSpend / best.marketAsk);
      const cost = contracts * best.marketAsk;
      const maxProfit = contracts * (1 - best.marketAsk);
      
      console.log(`\nPosition Size:`);
      console.log(`  ${contracts} contracts @ ${(best.marketAsk*100).toFixed(0)}¢`);
      console.log(`  Cost: $${cost.toFixed(2)}`);
      console.log(`  Max Profit: $${maxProfit.toFixed(2)} (+${((maxProfit/cost)*100).toFixed(0)}%)`);
      console.log(`  Expected Value: $${(contracts * best.fairProb - cost).toFixed(2)}`);
    } else {
      console.log('\n⚪ No trades with >5% edge found');
    }
  } else {
    console.log('Failed to fetch markets:', marketsRes);
  }
  
  // Also check 0817 event (more time)
  console.log('\n\n─── KXBTC-26FEB0817 (Closes ~22:00 UTC) ───\n');
  
  const markets2Res = await makeRequest('GET', '/markets?event_ticker=KXBTC-26FEB0817&limit=100');
  
  if (markets2Res.status === 200 && markets2Res.data.markets) {
    const markets = markets2Res.data.markets;
    const closeTime = new Date(markets[0].close_time);
    const now = new Date();
    const hoursToClose = (closeTime - now) / (1000 * 60 * 60);
    
    console.log(`Time to close: ${hoursToClose.toFixed(1)} hours`);
    
    // Check current bucket
    const currentBucket = markets.find(m => {
      const match = m.subtitle?.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
      if (!match) return false;
      const lower = parseFloat(match[1].replace(/,/g, ''));
      const upper = parseFloat(match[2].replace(/,/g, ''));
      return btcPrice >= lower && btcPrice < upper;
    });
    
    if (currentBucket) {
      console.log(`Current bucket: ${currentBucket.ticker}`);
      console.log(`  ${currentBucket.subtitle}`);
      console.log(`  YES bid/ask: ${currentBucket.yes_bid}¢ / ${currentBucket.yes_ask}¢`);
      console.log(`  Volume: ${currentBucket.volume}`);
      
      const match = currentBucket.subtitle.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
      const lower = parseFloat(match[1].replace(/,/g, ''));
      const upper = parseFloat(match[2].replace(/,/g, ''));
      const fairProb = bucketProbability(btcPrice, lower, upper, 0.45, hoursToClose);
      const edge = fairProb - currentBucket.yes_ask / 100;
      
      console.log(`  Fair prob: ${(fairProb*100).toFixed(1)}%`);
      console.log(`  Edge vs ask: ${(edge*100).toFixed(1)}%`);
    }
  }
}

main().catch(console.error);
