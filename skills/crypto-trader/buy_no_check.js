#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const BASE_URL = 'api.elections.kalshi.com';
const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const privateKey = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

function signRequest(timestampMs, method, path) {
    return crypto.sign('sha256', Buffer.from(`${timestampMs}${method}${path}`), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
    }).toString('base64');
}

function api(endpoint) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const req = https.request({
            hostname: BASE_URL, port: 443, path, method: 'GET',
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signRequest(timestampMs, 'GET', path),
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('BUY NO OPPORTUNITY CHECK');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // Check BTC bucket
    const btcTicker = 'KXBTC-26FEB0804-B69625';
    const btcMarket = await api(`/markets/${btcTicker}`);
    
    if (btcMarket.market) {
        const m = btcMarket.market;
        console.log('BTC B69625 ($69,500-$69,749.99):');
        console.log(`  YES bid/ask: ${m.yes_bid}¢ / ${m.yes_ask}¢`);
        console.log(`  NO bid/ask:  ${m.no_bid}¢ / ${m.no_ask}¢`);
        console.log(`  Volume: ${m.volume}`);
        console.log(`  Close: ${m.close_time}`);
        
        // Edge calculation
        const noAsk = m.no_ask / 100;
        const noFair = 1 - 0.304; // 69.6%
        const edge = noFair - noAsk;
        
        console.log(`\n  NO ask: ${(noAsk*100).toFixed(0)}¢`);
        console.log(`  NO fair value: ${(noFair*100).toFixed(1)}%`);
        console.log(`  Edge: ${(edge*100).toFixed(1)}%`);
        
        if (edge > 0.05) {
            console.log(`  ✅ TRADE: Buy NO at ${(noAsk*100).toFixed(0)}¢`);
            
            const balance = 19.37;
            const maxSpend = balance * 0.05;
            const contracts = Math.floor(maxSpend / noAsk);
            console.log(`  Position: ${contracts} contracts @ ${(noAsk*100).toFixed(0)}¢ = $${(contracts * noAsk).toFixed(2)}`);
            console.log(`  Win $${(contracts * (1 - noAsk)).toFixed(2)} if BTC exits this bucket`);
        }
    }
    
    console.log('\n');
    
    // Check ETH bucket
    const ethTicker = 'KXETH-26FEB0804-B2070';
    const ethMarket = await api(`/markets/${ethTicker}`);
    
    if (ethMarket.market) {
        const m = ethMarket.market;
        console.log('ETH B2070 ($2,060-$2,079.99):');
        console.log(`  YES bid/ask: ${m.yes_bid}¢ / ${m.yes_ask}¢`);
        console.log(`  NO bid/ask:  ${m.no_bid}¢ / ${m.no_ask}¢`);
        console.log(`  Volume: ${m.volume}`);
        
        const noAsk = m.no_ask / 100;
        const noFair = 1 - 0.478; // 52.2%
        const edge = noFair - noAsk;
        
        console.log(`\n  NO ask: ${(noAsk*100).toFixed(0)}¢`);
        console.log(`  NO fair value: ${(noFair*100).toFixed(1)}%`);
        console.log(`  Edge: ${(edge*100).toFixed(1)}%`);
        
        if (edge > 0.05) {
            console.log(`  ✅ TRADE: Buy NO at ${(noAsk*100).toFixed(0)}¢`);
        }
    }
    
    // Also check BTC B69875 (adjacent bucket above)
    console.log('\n');
    const btcAbove = await api('/markets/KXBTC-26FEB0804-B69875');
    if (btcAbove.market) {
        const m = btcAbove.market;
        console.log('BTC B69875 ($69,750-$69,999.99) - Adjacent bucket ABOVE:');
        console.log(`  YES bid/ask: ${m.yes_bid}¢ / ${m.yes_ask}¢`);
        console.log(`  My fair value: ~19.8%`);
        console.log(`  Edge vs ask: ${(0.198 - m.yes_ask/100)*100}%`);
    }
    
    // Time check
    const now = new Date();
    const close = new Date('2026-02-08T09:00:00Z');
    const minLeft = (close - now) / 60000;
    console.log(`\n\n⏰ TIME REMAINING: ${minLeft.toFixed(0)} minutes`);
}

main().catch(console.error);
