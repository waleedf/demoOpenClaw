const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

// Probability calculation using normal distribution
function normcdf(x) {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// Calculate bucket probability using lognormal distribution
function bucketProbability(currentPrice, lower, upper, volatility, hoursToExpiry) {
  // Annualized vol to time-adjusted vol
  const timeYears = hoursToExpiry / (24 * 365);
  const sigma = volatility * Math.sqrt(timeYears);
  
  // Lognormal: ln(S_T/S_0) ~ N(-sigma^2/2, sigma^2)
  const mu = -0.5 * sigma * sigma; // drift adjustment for risk-neutral
  
  // P(lower < S_T < upper) = N(d_upper) - N(d_lower)
  const d_upper = (Math.log(upper / currentPrice) - mu) / sigma;
  const d_lower = (Math.log(lower / currentPrice) - mu) / sigma;
  
  return normcdf(d_upper) - normcdf(d_lower);
}

// Calculate above-threshold probability
function aboveProbability(currentPrice, threshold, volatility, hoursToExpiry) {
  const timeYears = hoursToExpiry / (24 * 365);
  const sigma = volatility * Math.sqrt(timeYears);
  const mu = -0.5 * sigma * sigma;
  
  const d = (Math.log(threshold / currentPrice) - mu) / sigma;
  return 1 - normcdf(d);
}

async function main() {
  const BTC_PRICE = 69680;
  const HOURS_TO_EXPIRY = 13.8;
  
  // BTC annualized volatility estimates (from playbook research)
  // Recent 30-day realized vol is around 40-60% annualized
  // Let's use 50% as baseline and test sensitivity
  const VOLATILITIES = [0.40, 0.50, 0.60]; // 40%, 50%, 60% annualized
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           KALSHI BTC TRADING ANALYSIS - PLAYBOOK               ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║ Current BTC:     $${BTC_PRICE.toLocaleString().padEnd(8)}                              ║`);
  console.log(`║ Hours to Expiry: ${HOURS_TO_EXPIRY}                                        ║`);
  console.log(`║ Event:           KXBTC-26FEB0817 (Feb 8 @ 22:00 UTC)           ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Key buckets to analyze
  const buckets = [
    { ticker: 'B68250', lower: 68000, upper: 68500, marketYesBid: 0.03, marketYesAsk: 0.09 },
    { ticker: 'B68750', lower: 68500, upper: 69000, marketYesBid: 0.07, marketYesAsk: 0.13 },
    { ticker: 'B69250', lower: 69000, upper: 69500, marketYesBid: 0.15, marketYesAsk: 0.17 },
    { ticker: 'B69750', lower: 69500, upper: 70000, marketYesBid: 0.11, marketYesAsk: 0.16 }, // CURRENT
    { ticker: 'B70250', lower: 70000, upper: 70500, marketYesBid: 0.09, marketYesAsk: 0.15 },
    { ticker: 'B70750', lower: 70500, upper: 71000, marketYesBid: 0.08, marketYesAsk: 0.13 },
    { ticker: 'B71250', lower: 71000, upper: 71500, marketYesBid: 0.05, marketYesAsk: 0.11 },
  ];
  
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('FAIR VALUE ANALYSIS BY VOLATILITY ASSUMPTION');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  for (const vol of VOLATILITIES) {
    console.log(`\n▓▓▓ VOLATILITY: ${(vol*100).toFixed(0)}% ANNUALIZED ▓▓▓\n`);
    console.log('Bucket   | Range               | Fair Prob | Market Bid/Ask | Edge (vs ask) | Signal');
    console.log('---------|---------------------|-----------|----------------|---------------|--------');
    
    for (const b of buckets) {
      const fairProb = bucketProbability(BTC_PRICE, b.lower, b.upper, vol, HOURS_TO_EXPIRY);
      const marketMid = (b.marketYesBid + b.marketYesAsk) / 2;
      const edgeVsAsk = fairProb - b.marketYesAsk;
      const edgeVsBid = b.marketYesBid - fairProb;
      
      let signal = '';
      // Per playbook: need >5% edge for trades
      if (edgeVsAsk > 0.05) signal = '🟢 BUY YES';
      else if (edgeVsBid > 0.05) signal = '🔴 BUY NO';
      else signal = '⚪ PASS';
      
      const current = (BTC_PRICE >= b.lower && BTC_PRICE < b.upper) ? '→' : ' ';
      
      console.log(
        `${current}${b.ticker.padEnd(7)} | $${b.lower.toLocaleString()}-$${b.upper.toLocaleString()} | ` +
        `${(fairProb*100).toFixed(1).padStart(5)}%    | ` +
        `${(b.marketYesBid*100).toFixed(0).padStart(2)}¢ / ${(b.marketYesAsk*100).toFixed(0).padStart(2)}¢       | ` +
        `${(edgeVsAsk*100).toFixed(1).padStart(5)}%         | ${signal}`
      );
    }
  }
  
  // Expected move calculation
  console.log('\n\n═══════════════════════════════════════════════════════════════════');
  console.log('EXPECTED PRICE RANGE (1 Standard Deviation)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  for (const vol of VOLATILITIES) {
    const timeYears = HOURS_TO_EXPIRY / (24 * 365);
    const sigma = vol * Math.sqrt(timeYears);
    const expectedMovePercent = sigma;
    const expectedMoveDollar = BTC_PRICE * expectedMovePercent;
    const lower68 = BTC_PRICE * Math.exp(-sigma);
    const upper68 = BTC_PRICE * Math.exp(sigma);
    
    console.log(`${(vol*100).toFixed(0)}% vol: BTC likely between $${lower68.toFixed(0).toLocaleString()} - $${upper68.toFixed(0).toLocaleString()} (68% confidence)`);
    console.log(`         Expected move: ±$${expectedMoveDollar.toFixed(0)} (±${(expectedMovePercent*100).toFixed(1)}%)`);
  }
  
  // Sum of probabilities check
  console.log('\n\n═══════════════════════════════════════════════════════════════════');
  console.log('PROBABILITY SANITY CHECK (should sum to ~100%)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const allBuckets = [
    { lower: 58500, upper: 59000 },
    { lower: 59000, upper: 59500 },
    { lower: 59500, upper: 60000 },
    { lower: 60000, upper: 60500 },
    { lower: 60500, upper: 61000 },
    { lower: 61000, upper: 61500 },
    { lower: 61500, upper: 62000 },
    { lower: 62000, upper: 62500 },
    { lower: 62500, upper: 63000 },
    { lower: 63000, upper: 63500 },
    { lower: 63500, upper: 64000 },
    { lower: 64000, upper: 64500 },
    { lower: 64500, upper: 65000 },
    { lower: 65000, upper: 65500 },
    { lower: 65500, upper: 66000 },
    { lower: 66000, upper: 66500 },
    { lower: 66500, upper: 67000 },
    { lower: 67000, upper: 67500 },
    { lower: 67500, upper: 68000 },
    { lower: 68000, upper: 68500 },
    { lower: 68500, upper: 69000 },
    { lower: 69000, upper: 69500 },
    { lower: 69500, upper: 70000 },
    { lower: 70000, upper: 70500 },
    { lower: 70500, upper: 71000 },
    { lower: 71000, upper: 71500 },
    { lower: 71500, upper: 72000 },
    { lower: 72000, upper: 72500 },
    { lower: 72500, upper: 73000 },
    { lower: 73000, upper: 73500 },
    { lower: 73500, upper: 74000 },
    { lower: 74000, upper: 74500 },
    { lower: 74500, upper: 75000 },
    { lower: 75000, upper: 75500 },
    { lower: 75500, upper: 76000 },
    { lower: 76000, upper: 76500 },
    { lower: 76500, upper: 77000 },
    { lower: 77000, upper: 77500 },
  ];
  
  for (const vol of VOLATILITIES) {
    let sum = 0;
    for (const b of allBuckets) {
      sum += bucketProbability(BTC_PRICE, b.lower, b.upper, vol, HOURS_TO_EXPIRY);
    }
    // Add tails
    sum += aboveProbability(BTC_PRICE, 77500, vol, HOURS_TO_EXPIRY);
    sum += 1 - aboveProbability(BTC_PRICE, 58500, vol, HOURS_TO_EXPIRY);
    console.log(`${(vol*100).toFixed(0)}% vol: Sum of bucket probs = ${(sum*100).toFixed(1)}%`);
  }
  
  // Trading recommendation
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    TRADING RECOMMENDATION                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Using 50% vol as baseline
  const baseVol = 0.50;
  const currentBucketProb = bucketProbability(BTC_PRICE, 69500, 70000, baseVol, HOURS_TO_EXPIRY);
  const adjacentBucketProb = bucketProbability(BTC_PRICE, 69000, 69500, baseVol, HOURS_TO_EXPIRY);
  
  console.log('Using 50% annualized volatility baseline:\n');
  console.log(`Current bucket ($69,500-$70,000): Fair=${(currentBucketProb*100).toFixed(1)}%, Market ask=16¢`);
  console.log(`Edge vs ask: ${((currentBucketProb - 0.16)*100).toFixed(1)}%\n`);
  
  if (currentBucketProb > 0.21) { // >5% edge over 16¢ ask
    console.log('✅ POTENTIAL TRADE: Buy YES on B69750 at 16¢');
    console.log(`   Fair value: ${(currentBucketProb*100).toFixed(1)}¢`);
    console.log(`   Edge: ${((currentBucketProb - 0.16)*100).toFixed(1)}¢`);
    console.log(`   Payoff: Win $1 if BTC closes $69,500-$70,000`);
  } else if (currentBucketProb < 0.06) { // Market overpriced
    console.log('✅ POTENTIAL TRADE: Buy NO on B69750 at 89¢');
  } else {
    console.log('⚪ NO CLEAR EDGE at current prices');
    console.log('   Market pricing appears efficient within error bounds');
    console.log('   Wait for better divergence or use different vol assumption');
  }
  
  // Account constraints
  console.log('\n\nAccount: $19.37 available');
  console.log('Per playbook: Max 5% of bankroll per trade = $0.97');
  console.log('Recommended position: 5-6 contracts at 16¢ = ~$0.80-$0.96');
}

main().catch(console.error);
