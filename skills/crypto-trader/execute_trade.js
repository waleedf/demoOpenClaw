#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

function signRequest(timestampMs, method, path, body = '') {
    return crypto.sign('sha256', Buffer.from(`${timestampMs}${method}${path}${body}`), {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
    }).toString('base64');
}

function api(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const body = data ? JSON.stringify(data) : '';
        const req = https.request({
            hostname: 'api.elections.kalshi.com',
            port: 443, path, method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signRequest(timestampMs, method, path, body),
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
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    const ticker = 'KXBTC-26FEB0817-B70750';
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('EXECUTING TRADE');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // Check current market price
    const marketRes = await api('GET', `/markets/${ticker}`);
    if (marketRes.data.market) {
        const m = marketRes.data.market;
        console.log(`Market: ${ticker}`);
        console.log(`  ${m.subtitle}`);
        console.log(`  YES bid/ask: ${m.yes_bid}¢ / ${m.yes_ask}¢`);
        console.log(`  Status: ${m.status}`);
        console.log(`  Close: ${m.close_time}\n`);
    }
    
    // Check balance
    const balRes = await api('GET', '/portfolio/balance');
    const balance = balRes.data.balance / 100;
    console.log(`Account balance: $${balance.toFixed(2)}`);
    
    // Calculate position
    const maxSpend = balance * 0.05; // 5% max
    const askPrice = marketRes.data.market?.yes_ask || 33;
    const contracts = Math.min(2, Math.floor((maxSpend * 100) / askPrice));
    const totalCost = (contracts * askPrice) / 100;
    
    console.log(`Max position (5%): $${maxSpend.toFixed(2)}`);
    console.log(`Contracts: ${contracts} @ ${askPrice}¢ = $${totalCost.toFixed(2)}\n`);
    
    if (contracts < 1) {
        console.log('ERROR: Not enough balance for even 1 contract');
        return;
    }
    
    // Place market order (buy YES)
    console.log('Placing order...\n');
    
    const orderData = {
        ticker: ticker,
        action: 'buy',
        side: 'yes',
        type: 'market',
        count: contracts
    };
    
    console.log('Order params:', JSON.stringify(orderData, null, 2));
    
    const orderRes = await api('POST', '/portfolio/orders', orderData);
    
    console.log('\nOrder response:');
    console.log(`  Status: ${orderRes.status}`);
    console.log(`  Data: ${JSON.stringify(orderRes.data, null, 2)}`);
    
    if (orderRes.status === 200 || orderRes.status === 201) {
        console.log('\n✅ ORDER PLACED SUCCESSFULLY');
        
        // Check updated positions
        const posRes = await api('GET', '/portfolio/positions');
        console.log('\nUpdated positions:');
        if (posRes.data.market_positions) {
            for (const pos of posRes.data.market_positions) {
                console.log(`  ${pos.ticker}: ${pos.position} contracts`);
            }
        }
        
        // Check updated balance
        const newBalRes = await api('GET', '/portfolio/balance');
        console.log(`\nNew balance: $${(newBalRes.data.balance / 100).toFixed(2)}`);
    } else {
        console.log('\n❌ ORDER FAILED');
    }
}

main().catch(console.error);
