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

function api(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const body = data ? JSON.stringify(data) : '';
        const options = {
            hostname: BASE_URL, port: 443, path, method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signRequest(timestampMs, method, path, body),
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getETHPrice() {
    return new Promise((resolve) => {
        https.get('https://api.coinbase.com/v2/prices/ETH-USD/spot', (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                try { resolve(parseFloat(JSON.parse(d).data?.amount)); }
                catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function main() {
    const ethPrice = await getETHPrice();
    console.log(`\n🔹 LIVE ETH PRICE: $${ethPrice?.toFixed(2) || 'unknown'}\n`);
    
    // Get specific market
    const ticker = 'KXETH-26FEB0817-B2060';
    const market = await api('GET', `/markets/${ticker}`);
    
    if (market.market) {
        const m = market.market;
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log(`MARKET: ${ticker}`);
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log(`Title: ${m.title}`);
        console.log(`Subtitle: ${m.subtitle}`);
        console.log(`Status: ${m.status}`);
        console.log(`Close time: ${m.close_time}`);
        console.log(`\nPricing:`);
        console.log(`  YES bid/ask: ${m.yes_bid}¢ / ${m.yes_ask}¢`);
        console.log(`  NO bid/ask: ${m.no_bid}¢ / ${m.no_ask}¢`);
        console.log(`  Last trade: ${m.last_price}¢`);
        console.log(`  Volume: ${m.volume}`);
        console.log(`  Open Interest: ${m.open_interest}`);
        
        // Calculate time to close
        const closeTime = new Date(m.close_time);
        const now = new Date();
        const hoursLeft = (closeTime - now) / (1000 * 60 * 60);
        console.log(`\nTime remaining: ${hoursLeft.toFixed(1)} hours`);
        
        // Check if ETH is in this bucket
        const inBucket = ethPrice >= 2040 && ethPrice < 2080;
        console.log(`\nETH $${ethPrice?.toFixed(2)} is ${inBucket ? 'IN' : 'OUT OF'} bucket ($2,040-$2,079.99)`);
        
        if (!inBucket && ethPrice >= 2080) {
            console.log(`  → ETH is $${(ethPrice - 2079.99).toFixed(2)} ABOVE the bucket ceiling`);
            console.log(`  → Need ETH to DROP to land in this bucket`);
        }
    }
    
    // Get orderbook
    console.log('\n─── ORDER BOOK ───\n');
    const book = await api('GET', `/markets/${ticker}/orderbook`);
    
    if (book.orderbook) {
        console.log('YES side (bids to buy YES):');
        const yesBids = book.orderbook.yes || [];
        for (const [price, qty] of yesBids.slice(0, 5)) {
            console.log(`  ${price}¢ x ${qty}`);
        }
        
        console.log('\nNO side (bids to buy NO):');
        const noBids = book.orderbook.no || [];
        for (const [price, qty] of noBids.slice(0, 5)) {
            console.log(`  ${price}¢ x ${qty}`);
        }
    }
    
    // Also check the adjacent buckets
    console.log('\n─── ADJACENT BUCKETS ───\n');
    
    for (const b of ['B2040', 'B2060', 'B2080', 'B2100', 'B2120']) {
        const adjTicker = `KXETH-26FEB0817-${b}`;
        const adjMarket = await api('GET', `/markets/${adjTicker}`);
        if (adjMarket.market) {
            const am = adjMarket.market;
            console.log(`${b} (${am.subtitle}): ${am.yes_bid}¢/${am.yes_ask}¢ | Vol: ${am.volume}`);
        }
    }
    
    // Account check
    console.log('\n─── ACCOUNT ───\n');
    const balance = await api('GET', '/portfolio/balance');
    console.log(`Balance: $${(balance.balance / 100).toFixed(2)}`);
    
    // Trade recommendation
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    if (ethPrice >= 2080) {
        console.log('⚠️  ETH is currently ABOVE $2,080');
        console.log('    The B2060 bucket requires ETH to FALL to $2,040-$2,079.99');
        console.log('    This is a DIRECTIONAL BET that ETH will drop');
        console.log('\n    Consider instead:');
        console.log('    - B2080 or B2100 if you think ETH stays flat or rises slightly');
    } else {
        console.log('✅ ETH is IN the $2,040-$2,080 range');
        console.log('   Bet pays if ETH stays in this range at settlement');
    }
}

main().catch(console.error);
