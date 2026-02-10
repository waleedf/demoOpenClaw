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
            res.on('end', () => {
                try { resolve(JSON.parse(d)); }
                catch { resolve({ error: d }); }
            });
        });
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('SETTLEMENT CHECK - KXBTC-26FEB0817-B70750');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // Check market status
    const market = await api('/markets/KXBTC-26FEB0817-B70750');
    if (market.market) {
        const m = market.market;
        console.log('MARKET STATUS:');
        console.log(`  Ticker: ${m.ticker}`);
        console.log(`  Subtitle: ${m.subtitle}`);
        console.log(`  Status: ${m.status}`);
        console.log(`  Result: ${m.result || 'pending'}`);
        console.log(`  Close time: ${m.close_time}`);
        console.log(`  Settlement time: ${m.settlement_timer_seconds || 'N/A'}`);
        if (m.result) {
            console.log(`\n  🎯 OUTCOME: ${m.result === 'yes' ? 'YES WINS ✅' : 'NO WINS ❌'}`);
        }
    } else {
        console.log('Market response:', JSON.stringify(market, null, 2));
    }
    
    // Check current balance
    console.log('\n\nBALANCE:');
    const bal = await api('/portfolio/balance');
    console.log(`  Balance: $${(bal.balance / 100).toFixed(2)}`);
    console.log(`  Portfolio value: $${(bal.portfolio_value / 100).toFixed(2)}`);
    
    // Check positions
    console.log('\n\nPOSITIONS:');
    const pos = await api('/portfolio/positions');
    if (pos.market_positions) {
        for (const p of pos.market_positions) {
            console.log(`  ${p.ticker}:`);
            console.log(`    Contracts: ${p.position}`);
            console.log(`    Cost: $${(p.total_traded / 100).toFixed(2)}`);
            console.log(`    Realized P&L: $${(p.realized_pnl / 100).toFixed(2)}`);
        }
        
        if (pos.market_positions.length === 0 || !pos.market_positions.find(p => p.ticker === 'KXBTC-26FEB0817-B70750')) {
            console.log('\n  ⚠️ BTC position no longer shows - likely settled!');
        }
    }
    
    // Check settlement history
    console.log('\n\nCHECKING SETTLEMENTS:');
    const settlements = await api('/portfolio/settlements?limit=5');
    console.log(JSON.stringify(settlements, null, 2));
    
    // Get current BTC for reference
    const btc = await new Promise((resolve) => {
        https.get('https://api.coinbase.com/v2/prices/BTC-USD/spot', (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(d).data?.amount); }
                catch { resolve('unknown'); }
            });
        });
    });
    console.log(`\nCurrent BTC price: $${parseFloat(btc).toLocaleString()}`);
}

main().catch(console.error);
