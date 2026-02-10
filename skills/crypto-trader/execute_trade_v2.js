#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

function makeRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const body = data ? JSON.stringify(data) : '';
        
        // Sign: timestamp + method + path + body
        const message = `${timestampMs}${method}${path}${body}`;
        const signature = crypto.sign('sha256', Buffer.from(message), {
            key: PRIVATE_KEY,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
        }).toString('base64');
        
        const options = {
            hostname: 'api.elections.kalshi.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        
        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }
        
        console.log(`Request: ${method} ${path}`);
        console.log(`Timestamp: ${timestampMs}`);
        console.log(`Body: ${body}`);
        
        const req = https.request(options, (res) => {
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
    console.log('EXECUTING TRADE (v2)');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // First verify we can read (this works)
    console.log('1. Verifying API access...');
    const balRes = await makeRequest('GET', '/portfolio/balance');
    console.log(`   Balance response: ${balRes.status}\n`);
    
    if (balRes.status !== 200) {
        console.log('Cannot access balance, aborting');
        return;
    }
    
    const balance = balRes.data.balance / 100;
    console.log(`   Balance: $${balance.toFixed(2)}\n`);
    
    // Get current market
    console.log('2. Checking market...');
    const mktRes = await makeRequest('GET', `/markets/${ticker}`);
    const mkt = mktRes.data.market;
    console.log(`   ${mkt.subtitle}`);
    console.log(`   YES ask: ${mkt.yes_ask}¢\n`);
    
    // Try placing order
    console.log('3. Placing order...\n');
    
    const orderPayload = {
        ticker: ticker,
        action: 'buy',
        side: 'yes',
        type: 'market',
        count: 2
    };
    
    const orderRes = await makeRequest('POST', '/portfolio/orders', orderPayload);
    
    console.log(`\nResponse status: ${orderRes.status}`);
    console.log(`Response data: ${JSON.stringify(orderRes.data, null, 2)}`);
    
    if (orderRes.status >= 200 && orderRes.status < 300) {
        console.log('\n✅ SUCCESS!');
    } else {
        // Try alternative endpoint
        console.log('\nTrying alternative order format...');
        
        const altPayload = {
            ticker: ticker,
            client_order_id: `order-${Date.now()}`,
            action: 'buy',
            side: 'yes',
            type: 'market',
            count: 2
        };
        
        const altRes = await makeRequest('POST', '/portfolio/orders', altPayload);
        console.log(`Alt response: ${altRes.status}`);
        console.log(JSON.stringify(altRes.data, null, 2));
    }
}

main().catch(console.error);
