#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const BASE_URL = 'api.elections.kalshi.com';
const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const privateKey = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

function signRequest(timestampMs, method, path) {
    const message = `${timestampMs}${method}${path}`;
    return crypto.sign('sha256', Buffer.from(message), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
    }).toString('base64');
}

function api(endpoint) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const options = {
            hostname: BASE_URL, port: 443, path, method: 'GET',
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signRequest(timestampMs, 'GET', path),
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

async function getPrice(coin) {
    return new Promise((resolve) => {
        https.get(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                try { resolve(parseFloat(JSON.parse(d).data?.amount)); }
                catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
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

function bucketProb(current, lower, upper, vol, hours) {
    const timeYears = hours / (24 * 365);
    const sigma = vol * Math.sqrt(timeYears);
    const mu = -0.5 * sigma * sigma;
    const d_upper = (Math.log(upper / current) - mu) / sigma;
    const d_lower = (Math.log(lower / current) - mu) / sigma;
    return normcdf(d_upper) - normcdf(d_lower);
}

async function main() {
    const btc = await getPrice('BTC');
    const eth = await getPrice('ETH');
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('SHORT-TERM OPPORTUNITY SCAN (0804 Events ~ 45 min left)');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`\nBTC: $${btc?.toFixed(2)} | ETH: $${eth?.toFixed(2)}`);
    
    const closeTime = new Date('2026-02-08T09:00:00Z');
    const now = new Date();
    const hoursLeft = Math.max(0.05, (closeTime - now) / (1000 * 60 * 60));
    console.log(`Time left: ${(hoursLeft * 60).toFixed(0)} minutes\n`);
    
    // Scan BTC 0804
    console.log('─── BTC KXBTC-26FEB0804 ───\n');
    const btcRes = await api('/markets?event_ticker=KXBTC-26FEB0804&limit=100');
    
    if (btcRes.markets) {
        const vol = 0.50;
        
        // Find buckets with liquidity
        const buckets = btcRes.markets
            .filter(m => m.subtitle?.match(/\$[\d,]+ to/))
            .filter(m => m.volume > 0 || Math.abs(parseFloat(m.subtitle.match(/\$([\d,]+)/)[1].replace(/,/g,'')) - btc) < 500);
        
        console.log('Bucket      | Range                | YES Ask | Fair  | Edge  | In Bucket?');
        console.log('------------|----------------------|---------|-------|-------|----------');
        
        for (const m of buckets.slice(0, 12)) {
            const match = m.subtitle.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
            if (!match) continue;
            const lower = parseFloat(match[1].replace(/,/g, ''));
            const upper = parseFloat(match[2].replace(/,/g, ''));
            
            const fairProb = bucketProb(btc, lower, upper, vol, hoursLeft);
            const yesAsk = (m.yes_ask || 100) / 100;
            const edge = fairProb - yesAsk;
            
            const inBucket = btc >= lower && btc < upper;
            const mark = inBucket ? '→ YES' : '';
            const flag = edge > 0.05 ? '🟢' : (edge < -0.05 ? '🔴' : '');
            
            const ticker = m.ticker.split('-').pop();
            console.log(
                `${ticker.padEnd(11)} | $${lower.toLocaleString()}-$${upper.toLocaleString().padEnd(6)} | ` +
                `${(yesAsk*100).toFixed(0).padStart(4)}¢   | ${(fairProb*100).toFixed(1).padStart(5)}% | ${(edge*100).toFixed(1).padStart(5)}% | ${mark} ${flag}`
            );
        }
    }
    
    // Scan ETH 0804
    console.log('\n─── ETH KXETH-26FEB0804 ───\n');
    const ethRes = await api('/markets?event_ticker=KXETH-26FEB0804&limit=100');
    
    if (ethRes.markets) {
        const vol = 0.55;
        
        const buckets = ethRes.markets
            .filter(m => m.subtitle?.match(/\$[\d,]+ to/))
            .filter(m => m.volume > 0 || Math.abs(parseFloat(m.subtitle.match(/\$([\d,]+)/)[1].replace(/,/g,'')) - eth) < 60);
        
        console.log('Bucket  | Range             | YES Ask | Fair  | Edge  | In Bucket?');
        console.log('--------|-------------------|---------|-------|-------|----------');
        
        for (const m of buckets.slice(0, 12)) {
            const match = m.subtitle.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
            if (!match) continue;
            const lower = parseFloat(match[1].replace(/,/g, ''));
            const upper = parseFloat(match[2].replace(/,/g, ''));
            
            const fairProb = bucketProb(eth, lower, upper, vol, hoursLeft);
            const yesAsk = (m.yes_ask || 100) / 100;
            const edge = fairProb - yesAsk;
            
            const inBucket = eth >= lower && eth < upper;
            const mark = inBucket ? '→ YES' : '';
            const flag = edge > 0.05 ? '🟢' : (edge < -0.05 ? '🔴' : '');
            
            const ticker = m.ticker.split('-').pop();
            console.log(
                `${ticker.padEnd(7)} | $${lower.toLocaleString()}-$${upper.toLocaleString().padEnd(8)} | ` +
                `${(yesAsk*100).toFixed(0).padStart(4)}¢   | ${(fairProb*100).toFixed(1).padStart(5)}% | ${(edge*100).toFixed(1).padStart(5)}% | ${mark} ${flag}`
            );
        }
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('VERDICT');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // Calculate what current bucket probability should be for short timeframe
    const btcExpectedMove = btc * 0.50 * Math.sqrt(hoursLeft / (24 * 365));
    const ethExpectedMove = eth * 0.55 * Math.sqrt(hoursLeft / (24 * 365));
    
    console.log(`Expected moves in ${(hoursLeft*60).toFixed(0)} minutes:`);
    console.log(`  BTC: ±$${btcExpectedMove.toFixed(0)} (±${(btcExpectedMove/btc*100).toFixed(2)}%)`);
    console.log(`  ETH: ±$${ethExpectedMove.toFixed(2)} (±${(ethExpectedMove/eth*100).toFixed(2)}%)`);
}

main().catch(console.error);
