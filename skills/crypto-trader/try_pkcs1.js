#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');

async function tryPKCS1() {
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
    
    const msg = timestampMs + method + path + body;
    
    // Try PKCS1 v1.5 instead of PSS
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(msg);
    const sig = sign.sign(PRIVATE_KEY, 'base64');
    
    console.log('Using PKCS1 v1.5 signature');
    console.log('Message:', msg.substring(0, 80) + '...');
    
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
            res.on('end', () => {
                console.log(`Response: ${res.statusCode}`);
                console.log(d);
                resolve();
            });
        });
        req.on('error', console.error);
        req.write(body);
        req.end();
    });
}

// Check what the private key looks like
console.log('Private key type check:');
const key = crypto.createPrivateKey(PRIVATE_KEY);
console.log('Key type:', key.asymmetricKeyType);
console.log('Key size:', key.asymmetricKeyDetails);
console.log();

tryPKCS1().catch(console.error);
