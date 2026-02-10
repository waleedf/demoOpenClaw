#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

async function tryOrder(includeBody = true, saltLen = 'max') {
    const timestampMs = Date.now().toString();
    const method = 'POST';
    const path = '/trade-api/v2/portfolio/orders';
    const body = JSON.stringify({
        ticker: 'KXBTC-26FEB0817-B70750',
        action: 'buy',
        side: 'yes',
        type: 'market',
        count: 1
    });
    
    // Try with/without body in signature
    const msg = includeBody ? (timestampMs + method + path + body) : (timestampMs + method + path);
    
    const saltLengthVal = saltLen === 'max' 
        ? crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN 
        : (saltLen === 'digest' ? crypto.constants.RSA_PSS_SALTLEN_DIGEST : 32);
    
    const sig = crypto.sign('sha256', Buffer.from(msg), {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: saltLengthVal
    }).toString('base64');
    
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.elections.kalshi.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': sig,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', (e) => resolve({ status: 0, body: e.message }));
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log('Testing different signature approaches:\n');
    
    // Test 1: With body, max salt
    let r = await tryOrder(true, 'max');
    console.log(`With body, max salt: ${r.status}`);
    
    // Test 2: Without body, max salt
    r = await tryOrder(false, 'max');
    console.log(`No body, max salt: ${r.status}`);
    
    // Test 3: With body, digest salt
    r = await tryOrder(true, 'digest');
    console.log(`With body, digest salt: ${r.status}`);
    
    // Test 4: Without body, digest salt
    r = await tryOrder(false, 'digest');
    console.log(`No body, digest salt: ${r.status}`);
    
    // Test 5: With body, fixed 32 salt
    r = await tryOrder(true, 32);
    console.log(`With body, 32 salt: ${r.status}`);
    
    console.log('\nLast response:', r.body);
}

main().catch(console.error);
