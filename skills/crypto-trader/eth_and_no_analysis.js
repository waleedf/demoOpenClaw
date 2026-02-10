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

function aboveProb(current, threshold, vol, hours) {
    const timeYears = hours / (24 * 365);
    const sigma = vol * Math.sqrt(timeYears);
    const mu = -0.5 * sigma * sigma;
    const d = (Math.log(threshold / current) - mu) / sigma;
    return 1 - normcdf(d);
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
    const ETH = 2079;
    const BTC = 69584;
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('ETH MARKET ANALYSIS - KXETH-26FEB0817 (Today)');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`\nETH: $${ETH.toLocaleString()}`);
    console.log('Hours to expiry: 13.8\n');
    
    const ethRes = await api('GET', '/markets?event_ticker=KXETH-26FEB0817&limit=100');
    
    if (ethRes.markets) {
        const vol = 0.55; // ETH typically more volatile than BTC
        const hours = 13.8;
        
        // Analyze buckets
        const buckets = ethRes.markets.filter(m => m.subtitle?.match(/\$[\d,]+ to/));
        
        console.log('Bucket   | Range           | YES Bid/Ask | Fair  | Edge (YES) | Edge (NO)');
        console.log('---------|-----------------|-------------|-------|------------|----------');
        
        const opportunities = [];
        
        for (const m of buckets) {
            const match = m.subtitle?.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
            if (!match) continue;
            
            const lower = parseFloat(match[1].replace(/,/g, ''));
            const upper = parseFloat(match[2].replace(/,/g, ''));
            
            const fairProb = bucketProb(ETH, lower, upper, vol, hours);
            const yesAsk = (m.yes_ask || 100) / 100;
            const yesBid = (m.yes_bid || 0) / 100;
            const noAsk = (m.no_ask || 100) / 100;
            const noBid = (m.no_bid || 0) / 100;
            
            const edgeYes = fairProb - yesAsk;
            const edgeNo = (1 - fairProb) - noAsk;
            
            const current = ETH >= lower && ETH < upper;
            const mark = current ? '→' : ' ';
            
            const ticker = m.ticker.split('-').pop();
            
            opportunities.push({
                ticker, lower, upper, fairProb, yesAsk, yesBid, noAsk, noBid,
                edgeYes, edgeNo, volume: m.volume, current
            });
            
            if (Math.abs(lower - ETH) < 200 || Math.abs(upper - ETH) < 200) {
                const yesFlag = edgeYes > 0.05 ? '🟢' : '';
                const noFlag = edgeNo > 0.05 ? '🟢' : '';
                
                console.log(
                    `${mark}${ticker.padEnd(7)} | $${lower}-$${upper} | ` +
                    `${(yesBid*100).toFixed(0).padStart(2)}¢/${(yesAsk*100).toFixed(0).padStart(2)}¢      | ` +
                    `${(fairProb*100).toFixed(1).padStart(5)}% | ` +
                    `${(edgeYes*100).toFixed(1).padStart(5)}%    ${yesFlag} | ` +
                    `${(edgeNo*100).toFixed(1).padStart(5)}%   ${noFlag}`
                );
            }
        }
        
        // Find best NO opportunity
        const bestNo = opportunities.filter(o => o.edgeNo > 0).sort((a,b) => b.edgeNo - a.edgeNo)[0];
        if (bestNo) {
            console.log(`\n🎯 Best NO opportunity: ${bestNo.ticker}`);
            console.log(`   Buy NO at ${(bestNo.noAsk*100).toFixed(0)}¢, fair value ${((1-bestNo.fairProb)*100).toFixed(1)}%`);
            console.log(`   Edge: ${(bestNo.edgeNo*100).toFixed(1)}%`);
        }
    }
    
    // Now check for buy-NO opportunities across all BTC markets
    console.log('\n\n═══════════════════════════════════════════════════════════════════');
    console.log('BUY NO OPPORTUNITIES - Looking for OVERPRICED YES');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    const btcRes = await api('GET', '/markets?event_ticker=KXBTC-26FEB0817&limit=100');
    
    if (btcRes.markets) {
        const vol = 0.50;
        const hours = 13.8;
        
        const opportunities = [];
        
        for (const m of btcRes.markets) {
            // Buckets
            const bucketMatch = m.subtitle?.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
            if (bucketMatch) {
                const lower = parseFloat(bucketMatch[1].replace(/,/g, ''));
                const upper = parseFloat(bucketMatch[2].replace(/,/g, ''));
                const fairProb = bucketProb(BTC, lower, upper, vol, hours);
                const noAsk = (m.no_ask || 100) / 100;
                const noBid = (m.no_bid || 0) / 100;
                const noFair = 1 - fairProb;
                const edgeNo = noFair - noAsk;
                
                opportunities.push({
                    ticker: m.ticker,
                    subtitle: m.subtitle,
                    type: 'bucket',
                    fairProb,
                    noFair,
                    noAsk,
                    noBid,
                    edgeNo,
                    volume: m.volume
                });
            }
            
            // Above thresholds
            const aboveMatch = m.subtitle?.match(/\$([\d,]+(?:\.\d+)?)\s+or\s+above/);
            if (aboveMatch) {
                const threshold = parseFloat(aboveMatch[1].replace(/,/g, ''));
                const fairProb = aboveProb(BTC, threshold, vol, hours);
                const noAsk = (m.no_ask || 100) / 100;
                const noFair = 1 - fairProb;
                const edgeNo = noFair - noAsk;
                
                opportunities.push({
                    ticker: m.ticker,
                    subtitle: m.subtitle,
                    type: 'above',
                    fairProb,
                    noFair,
                    noAsk,
                    edgeNo,
                    volume: m.volume
                });
            }
        }
        
        // Sort by NO edge
        opportunities.sort((a, b) => b.edgeNo - a.edgeNo);
        
        console.log('Top opportunities to BUY NO (bet against YES):\n');
        console.log('Market                      | NO Ask | NO Fair | Edge  | Vol');
        console.log('----------------------------|--------|---------|-------|----');
        
        for (const o of opportunities.slice(0, 15)) {
            const flag = o.edgeNo > 0.03 ? '🎯' : '';
            console.log(
                `${o.subtitle?.slice(0, 27).padEnd(27)} | ` +
                `${(o.noAsk*100).toFixed(0).padStart(4)}¢  | ` +
                `${(o.noFair*100).toFixed(1).padStart(5)}%  | ` +
                `${(o.edgeNo*100).toFixed(1).padStart(5)}% | ` +
                `${o.volume} ${flag}`
            );
        }
        
        // Highlight actionable trade
        const actionable = opportunities.filter(o => o.edgeNo > 0.03 && o.noAsk < 0.98);
        if (actionable.length > 0) {
            const best = actionable[0];
            console.log('\n═══════════════════════════════════════════════════════════════════');
            console.log('🎯 POTENTIAL TRADE: BUY NO');
            console.log('═══════════════════════════════════════════════════════════════════');
            console.log(`Market: ${best.ticker}`);
            console.log(`Bet: "${best.subtitle}" will NOT happen`);
            console.log(`Buy NO at: ${(best.noAsk*100).toFixed(0)}¢`);
            console.log(`Fair value: ${(best.noFair*100).toFixed(1)}%`);
            console.log(`Edge: ${(best.edgeNo*100).toFixed(1)}%`);
            console.log(`Volume: ${best.volume}`);
            
            // Position sizing
            const balance = 19.37;
            const maxSpend = balance * 0.05;
            const contracts = Math.floor(maxSpend / best.noAsk);
            console.log(`\nPosition: ${contracts} contracts @ ${(best.noAsk*100).toFixed(0)}¢ = $${(contracts * best.noAsk).toFixed(2)}`);
            console.log(`Max profit: $${(contracts * (1 - best.noAsk)).toFixed(2)} if NO wins`);
        }
    }
}

main().catch(console.error);
