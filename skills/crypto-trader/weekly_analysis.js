#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const BASE_URL = 'api.elections.kalshi.com';
const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const privateKey = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

function signRequest(timestampMs, method, path, body = '') {
    const message = `${timestampMs}${method}${path}${body}`;
    return crypto.sign('sha256', Buffer.from(message), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
    }).toString('base64');
}

function api(method, endpoint) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const options = {
            hostname: BASE_URL, port: 443, path, method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signRequest(timestampMs, method, path),
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => resolve(JSON.parse(d)));
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

// Probability BTC above threshold
function aboveProb(current, threshold, vol, hours) {
    const timeYears = hours / (24 * 365);
    const sigma = vol * Math.sqrt(timeYears);
    const mu = -0.5 * sigma * sigma;
    const d = (Math.log(threshold / current) - mu) / sigma;
    return 1 - normcdf(d);
}

async function main() {
    const BTC = 69584;
    const ETH = 2079;
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('WEEKLY MARKET ANALYSIS - KXBTC-26FEB1317 (Feb 13)');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`\nBTC: $${BTC.toLocaleString()} | ETH: $${ETH.toLocaleString()}`);
    console.log('Hours to expiry: 133.8 (~5.6 days)\n');
    
    const res = await api('GET', '/markets?event_ticker=KXBTC-26FEB1317&limit=100');
    
    if (!res.markets) {
        console.log('Error:', res);
        return;
    }
    
    console.log('─── THRESHOLD MARKETS (Above X) ───\n');
    
    const thresholds = res.markets.filter(m => m.subtitle?.includes('or above'));
    
    // Different vol scenarios
    const vols = [0.45, 0.55, 0.65, 0.75];
    const hours = 133.8;
    
    console.log('Threshold    | Market Bid/Ask | Vol    | Fair@45% | Fair@55% | Fair@65% | Fair@75%');
    console.log('-------------|----------------|--------|----------|----------|----------|----------');
    
    for (const m of thresholds) {
        const match = m.subtitle?.match(/\$([\d,]+(?:\.\d+)?)/);
        if (!match) continue;
        const threshold = parseFloat(match[1].replace(/,/g, ''));
        
        const yb = m.yes_bid || 0;
        const ya = m.yes_ask || 100;
        
        const probs = vols.map(v => aboveProb(BTC, threshold, v, hours));
        
        const edges = probs.map(p => p - ya/100);
        const hasEdge = edges.some(e => e > 0.03);
        const flag = hasEdge ? '🎯' : '';
        
        console.log(
            `>$${(threshold/1000).toFixed(1)}k`.padEnd(12) + ' | ' +
            `${yb}¢/${ya}¢`.padEnd(14) + ' | ' +
            `${m.volume}`.padStart(6) + ' | ' +
            `${(probs[0]*100).toFixed(1)}%`.padStart(8) + ' | ' +
            `${(probs[1]*100).toFixed(1)}%`.padStart(8) + ' | ' +
            `${(probs[2]*100).toFixed(1)}%`.padStart(8) + ' | ' +
            `${(probs[3]*100).toFixed(1)}%`.padStart(8) + ' ' + flag
        );
    }
    
    // Check below thresholds too
    console.log('\n─── THRESHOLD MARKETS (Below X) ───\n');
    
    const belows = res.markets.filter(m => m.subtitle?.includes('or below'));
    
    for (const m of belows) {
        const match = m.subtitle?.match(/\$([\d,]+(?:\.\d+)?)/);
        if (!match) continue;
        const threshold = parseFloat(match[1].replace(/,/g, ''));
        
        const yb = m.yes_bid || 0;
        const ya = m.yes_ask || 100;
        
        // Probability below = 1 - probability above
        const probs = vols.map(v => 1 - aboveProb(BTC, threshold, v, hours));
        
        console.log(
            `<$${(threshold/1000).toFixed(1)}k`.padEnd(12) + ' | ' +
            `${yb}¢/${ya}¢`.padEnd(14) + ' | ' +
            `${m.volume}`.padStart(6) + ' | ' +
            `${(probs[0]*100).toFixed(1)}%`.padStart(8) + ' | ' +
            `${(probs[1]*100).toFixed(1)}%`.padStart(8) + ' | ' +
            `${(probs[2]*100).toFixed(1)}%`.padStart(8) + ' | ' +
            `${(probs[3]*100).toFixed(1)}%`.padStart(8)
        );
    }
    
    // Highlight biggest opportunity
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('OPPORTUNITY ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // T77499.99 - BTC above $77.5k by Feb 13
    const target = thresholds.find(m => m.subtitle?.includes('77,500'));
    if (target) {
        const threshold = 77500;
        console.log(`TARGET: ${target.ticker}`);
        console.log(`Bet: BTC above $77,500 by Feb 13, 22:00 UTC`);
        console.log(`Market: ${target.yes_bid}¢ bid / ${target.yes_ask}¢ ask`);
        console.log(`Volume: ${target.volume}`);
        console.log('');
        
        // Calculate required move
        const moveNeeded = ((threshold - BTC) / BTC * 100).toFixed(1);
        console.log(`Current BTC: $${BTC.toLocaleString()}`);
        console.log(`Required move: +${moveNeeded}% (+$${(threshold - BTC).toLocaleString()})`);
        console.log('');
        
        // Probabilities
        console.log('Fair probabilities by vol assumption:');
        for (const v of vols) {
            const prob = aboveProb(BTC, threshold, v, hours);
            const edge = prob - target.yes_ask/100;
            console.log(`  ${(v*100).toFixed(0)}% vol: ${(prob*100).toFixed(1)}% fair → edge ${(edge*100).toFixed(1)}%`);
        }
        
        // Historical context
        console.log('\nHistorical context:');
        console.log('  - BTC 30-day realized vol typically 40-70%');
        console.log('  - ATH was $109k (Nov 2024), current $69.5k is -36% from ATH');
        console.log('  - A +11% move in 5.6 days needs ~3 sigma at 45% vol');
        console.log('  - Or ~2 sigma at 65% vol');
    }
    
    // Also check the current bucket for weekly
    console.log('\n─── CURRENT BUCKET WEEKLY ───\n');
    
    const buckets = res.markets.filter(m => m.subtitle?.match(/\$[\d,]+ to/));
    const currentBucket = buckets.find(m => {
        const match = m.subtitle?.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
        if (!match) return false;
        const lower = parseFloat(match[1].replace(/,/g, ''));
        const upper = parseFloat(match[2].replace(/,/g, ''));
        return BTC >= lower && BTC < upper;
    });
    
    if (currentBucket) {
        console.log(`Current bucket: ${currentBucket.ticker}`);
        console.log(`  ${currentBucket.subtitle}`);
        console.log(`  Market: ${currentBucket.yes_bid}¢/${currentBucket.yes_ask}¢`);
        console.log(`  Volume: ${currentBucket.volume}`);
        
        // For weekly, prob of staying in $500 bucket is very low
        // Expected move over 5.6 days at 50% vol:
        const sigma5d = 0.50 * Math.sqrt(5.6 / 365);
        const expectedMove = BTC * sigma5d;
        console.log(`\n  Expected 1-sigma move (50% vol): ±$${expectedMove.toFixed(0)} (±${(sigma5d*100).toFixed(1)}%)`);
        console.log(`  Bucket width: $500`);
        console.log(`  → Very low probability of staying in current bucket`);
    }
}

main().catch(console.error);
