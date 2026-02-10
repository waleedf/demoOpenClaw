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

function api(endpoint) {
    return new Promise((resolve) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const sig = signPssText(timestampMs + 'GET' + path);
        
        https.get({
            hostname: 'api.elections.kalshi.com',
            path: path,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-SIGNATURE': sig,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs
            }
        }, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => resolve(JSON.parse(d)));
        });
    });
}

async function main() {
    // Get positions
    console.log('=== POSITIONS ===');
    const pos = await api('/portfolio/positions');
    console.log(JSON.stringify(pos, null, 2));
    
    // Get fills (recent trades)
    console.log('\n=== RECENT FILLS ===');
    const fills = await api('/portfolio/fills?limit=5');
    console.log(JSON.stringify(fills, null, 2));
    
    // Get balance
    console.log('\n=== BALANCE ===');
    const bal = await api('/portfolio/balance');
    console.log(JSON.stringify(bal, null, 2));
    
    // Get BTC price
    const btc = await new Promise((resolve) => {
        https.get('https://api.coinbase.com/v2/prices/BTC-USD/spot', (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => resolve(JSON.parse(d).data?.amount));
        });
    });
    console.log(`\nCurrent BTC: $${parseFloat(btc).toLocaleString()}`);
    console.log('Target range: $70,500 - $70,999.99');
    console.log(`Status: BTC is ${parseFloat(btc) >= 70500 && parseFloat(btc) < 71000 ? 'IN ✅' : 'OUT ❌'} the range`);
}

main().catch(console.error);
