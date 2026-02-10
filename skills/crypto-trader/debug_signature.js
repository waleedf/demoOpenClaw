#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

// According to Kalshi docs, signature is:
// sign(timestamp_ms + method + path + body)
// Using RSA-PSS with SHA-256

async function testOrder() {
    const timestampMs = Date.now().toString();
    const method = 'POST';
    const path = '/trade-api/v2/portfolio/orders';
    const body = JSON.stringify({
        ticker: 'KXBTC-26FEB0817-B70750',
        action: 'buy',
        side: 'yes',
        type: 'market',
        count: 2
    });
    
    // Different signature approaches
    console.log('Testing signature approaches...\n');
    
    // Approach 1: Message as documented
    const msg1 = timestampMs + method + path + body;
    console.log('Message to sign:', msg1);
    console.log('Length:', msg1.length);
    
    const sig1 = crypto.sign('sha256', Buffer.from(msg1), {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
    }).toString('base64');
    
    console.log('\nSignature:', sig1.substring(0, 50) + '...');
    
    // Try the request
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.elections.kalshi.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': sig1,
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                console.log(`\nResponse: ${res.statusCode}`);
                console.log(d);
                resolve();
            });
        });
        
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Also try to find any Kalshi API examples
async function checkDocs() {
    // Check if there's a different order endpoint
    const endpoints = [
        '/portfolio/orders',
        '/orders',
        '/exchange/orders'
    ];
    
    console.log('\n\nTrying different endpoints...');
    
    for (const ep of endpoints) {
        const timestampMs = Date.now().toString();
        const method = 'POST';
        const path = `/trade-api/v2${ep}`;
        const body = JSON.stringify({
            ticker: 'KXBTC-26FEB0817-B70750',
            action: 'buy',
            side: 'yes', 
            type: 'market',
            count: 1
        });
        
        const msg = timestampMs + method + path + body;
        const sig = crypto.sign('sha256', Buffer.from(msg), {
            key: PRIVATE_KEY,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
        }).toString('base64');
        
        const result = await new Promise((resolve) => {
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
            req.on('error', () => resolve({ status: 0, body: 'error' }));
            req.write(body);
            req.end();
        });
        
        console.log(`${ep}: ${result.status} - ${result.body.substring(0, 100)}`);
    }
}

testOrder().then(checkDocs).catch(console.error);
