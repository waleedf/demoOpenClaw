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
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST  // Correct!
    }).toString('base64');
}

async function placeOrder() {
    const timestampMs = Date.now().toString();
    const method = 'POST';
    const path = '/trade-api/v2/portfolio/orders';
    
    // Body NOT included in signature per docs
    const msgString = timestampMs + method + path;
    const sig = signPssText(msgString);
    
    const body = JSON.stringify({
        ticker: 'KXBTC-26FEB0817-B70750',
        action: 'buy',
        side: 'yes',
        type: 'market',
        count: 2
    });
    
    console.log('Message to sign:', msgString);
    console.log('Body (not signed):', body);
    
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.elections.kalshi.com',
            port: 443,
            path: path,
            method: method,
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
                console.log(`\nResponse: ${res.statusCode}`);
                console.log(d);
                resolve({ status: res.statusCode, data: d });
            });
        });
        req.on('error', console.error);
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('PLACING ORDER (Correct Signature)');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    const result = await placeOrder();
    
    if (result.status >= 200 && result.status < 300) {
        console.log('\n✅ ORDER SUCCESS!');
        
        // Check positions
        const posPath = '/trade-api/v2/portfolio/positions';
        const posMsg = Date.now().toString() + 'GET' + posPath;
        const posSig = signPssText(posMsg);
        
        const posRes = await new Promise((resolve) => {
            https.get({
                hostname: 'api.elections.kalshi.com',
                path: posPath,
                headers: {
                    'KALSHI-ACCESS-KEY': API_KEY_ID,
                    'KALSHI-ACCESS-SIGNATURE': posSig,
                    'KALSHI-ACCESS-TIMESTAMP': Date.now().toString()
                }
            }, (res) => {
                let d = '';
                res.on('data', chunk => d += chunk);
                res.on('end', () => resolve(d));
            });
        });
        
        console.log('\nPositions:', posRes);
    }
}

main().catch(console.error);
