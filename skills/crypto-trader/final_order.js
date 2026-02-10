#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

function signPssText(text) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(text);
    sign.end();
    return sign.sign({
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    }).toString('base64');
}

function api(method, endpoint, body = null) {
    return new Promise((resolve) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const msgString = timestampMs + method + path;
        const sig = signPssText(msgString);
        const bodyStr = body ? JSON.stringify(body) : '';
        
        const req = https.request({
            hostname: 'api.elections.kalshi.com',
            port: 443, path, method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-SIGNATURE': sig,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch { resolve({ status: res.statusCode, data: d }); }
            });
        });
        req.on('error', (e) => resolve({ status: 0, data: e.message }));
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function main() {
    const ticker = 'KXBTC-26FEB0817-B70750';
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('EXECUTING TRADE');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // Get current market price
    const mktRes = await api('GET', `/markets/${ticker}`);
    const market = mktRes.data.market;
    console.log(`Market: ${ticker}`);
    console.log(`  ${market.subtitle}`);
    console.log(`  YES bid/ask: ${market.yes_bid}¢ / ${market.yes_ask}¢`);
    console.log(`  Close: ${market.close_time}`);
    
    // Get balance
    const balRes = await api('GET', '/portfolio/balance');
    console.log(`\nBalance: $${(balRes.data.balance / 100).toFixed(2)}`);
    
    // Place order with price
    const askPrice = market.yes_ask; // in cents
    const contracts = 2;
    
    console.log(`\nPlacing order: ${contracts} YES @ ${askPrice}¢`);
    
    const orderRes = await api('POST', '/portfolio/orders', {
        ticker: ticker,
        action: 'buy',
        side: 'yes',
        type: 'limit',
        yes_price: askPrice,
        count: contracts
    });
    
    console.log(`\nOrder response: ${orderRes.status}`);
    console.log(JSON.stringify(orderRes.data, null, 2));
    
    if (orderRes.status >= 200 && orderRes.status < 300) {
        console.log('\n✅ ORDER PLACED!');
        
        // Check positions
        const posRes = await api('GET', '/portfolio/positions');
        console.log('\nPositions:');
        for (const pos of (posRes.data.market_positions || [])) {
            console.log(`  ${pos.ticker}: ${pos.position} contracts`);
        }
        
        // Check new balance
        const newBalRes = await api('GET', '/portfolio/balance');
        console.log(`\nNew balance: $${(newBalRes.data.balance / 100).toFixed(2)}`);
    }
}

main().catch(console.error);
