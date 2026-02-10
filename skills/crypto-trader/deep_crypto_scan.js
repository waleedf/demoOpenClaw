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

async function getPrice(coin) {
    return new Promise((resolve) => {
        https.get(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                try { resolve(parseFloat(JSON.parse(d).data?.amount)); }
                catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

// All crypto series to check
const CRYPTO_SERIES = ['KXBTC', 'KXETH', 'KXSOL', 'KXDOGE', 'KXAVAX', 'KXRIPPLED', 'KXSHIBA'];
const COIN_MAP = {
    'KXBTC': 'BTC', 'KXETH': 'ETH', 'KXSOL': 'SOL', 
    'KXDOGE': 'DOGE', 'KXAVAX': 'AVAX', 'KXRIPPLED': 'XRP', 'KXSHIBA': 'SHIB'
};

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('DEEP CRYPTO MARKET SCAN - ALL SERIES');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    // Get all prices
    const prices = {};
    for (const [series, coin] of Object.entries(COIN_MAP)) {
        prices[series] = await getPrice(coin);
        if (prices[series]) console.log(`${coin}: $${prices[series].toLocaleString()}`);
    }
    
    console.log('\n');
    
    // Scan each series
    for (const series of CRYPTO_SERIES) {
        console.log(`\n${'─'.repeat(65)}`);
        console.log(`SCANNING: ${series}`);
        console.log('─'.repeat(65));
        
        const res = await api('GET', `/markets?series_ticker=${series}&status=open&limit=200`);
        
        if (!res.markets || res.markets.length === 0) {
            console.log('No open markets found');
            continue;
        }
        
        console.log(`Found ${res.markets.length} open markets\n`);
        
        // Group by event
        const events = {};
        for (const m of res.markets) {
            if (!events[m.event_ticker]) events[m.event_ticker] = [];
            events[m.event_ticker].push(m);
        }
        
        for (const [eventTicker, markets] of Object.entries(events)) {
            const sample = markets[0];
            const closeTime = new Date(sample.close_time);
            const now = new Date();
            const hoursLeft = (closeTime - now) / (1000 * 60 * 60);
            
            if (hoursLeft < 0) continue; // Skip expired
            
            console.log(`\n📅 ${eventTicker}`);
            console.log(`   Closes: ${closeTime.toISOString()} (${hoursLeft.toFixed(1)}h left)`);
            console.log(`   Markets: ${markets.length}`);
            
            // Sort by volume and show top ones
            const byVol = [...markets].sort((a,b) => (b.volume||0) - (a.volume||0));
            const withVol = byVol.filter(m => m.volume > 0);
            
            if (withVol.length > 0) {
                console.log(`   Active markets (with volume):`);
                for (const m of withVol.slice(0, 8)) {
                    const yb = m.yes_bid || 0;
                    const ya = m.yes_ask || 0;
                    const spread = ya - yb;
                    const mid = (yb + ya) / 2;
                    
                    // Check for wide spreads (opportunity)
                    const spreadPct = spread / (mid || 1);
                    const flag = spreadPct > 0.3 ? '⚠️ WIDE' : '';
                    
                    console.log(`     ${m.ticker.split('-').pop()}: ${yb}¢/${ya}¢ (spread ${spread}¢) vol:${m.volume} ${flag}`);
                }
            }
            
            // Look for mispriced extremes
            const extremes = markets.filter(m => {
                const ya = m.yes_ask || 100;
                const yb = m.yes_bid || 0;
                // Low asks on unlikely events or high bids on likely
                return (ya <= 5 && ya > 0) || (yb >= 95);
            });
            
            if (extremes.length > 0) {
                console.log(`   🎯 Extreme prices:`);
                for (const m of extremes.slice(0, 5)) {
                    console.log(`     ${m.ticker.split('-').pop()}: ${m.yes_bid}¢/${m.yes_ask}¢ "${m.subtitle?.slice(0, 40)}"`);
                }
            }
        }
    }
    
    // Also scan for any other interesting markets
    console.log('\n\n═══════════════════════════════════════════════════════════════════');
    console.log('SCANNING ALL MARKETS FOR CRYPTO KEYWORDS');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    let cursor = null;
    let allMarkets = [];
    
    // Paginate through markets
    for (let i = 0; i < 10; i++) {
        const url = cursor 
            ? `/markets?status=open&limit=200&cursor=${cursor}`
            : '/markets?status=open&limit=200';
        const res = await api('GET', url);
        
        if (!res.markets || res.markets.length === 0) break;
        allMarkets = allMarkets.concat(res.markets);
        cursor = res.cursor;
        if (!cursor) break;
    }
    
    console.log(`Total markets scanned: ${allMarkets.length}`);
    
    // Find crypto-related
    const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'doge', 'ripple', 'xrp'];
    const cryptoMarkets = allMarkets.filter(m => {
        const text = `${m.ticker} ${m.title} ${m.subtitle}`.toLowerCase();
        return cryptoKeywords.some(k => text.includes(k));
    });
    
    console.log(`Crypto-related markets: ${cryptoMarkets.length}\n`);
    
    // Group and show
    const byTicker = {};
    for (const m of cryptoMarkets) {
        const series = m.ticker.split('-')[0];
        if (!byTicker[series]) byTicker[series] = [];
        byTicker[series].push(m);
    }
    
    for (const [series, markets] of Object.entries(byTicker)) {
        console.log(`${series}: ${markets.length} markets`);
    }
    
    // Check for weekly/monthly crypto markets
    console.log('\n\n═══════════════════════════════════════════════════════════════════');
    console.log('SEARCHING FOR LONGER-DATED CRYPTO EVENTS');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    
    const eventsRes = await api('GET', '/events?status=open&limit=200');
    if (eventsRes.events) {
        const cryptoEvents = eventsRes.events.filter(e => {
            const text = `${e.ticker} ${e.title}`.toLowerCase();
            return cryptoKeywords.some(k => text.includes(k));
        });
        
        console.log(`Crypto events found: ${cryptoEvents.length}\n`);
        for (const e of cryptoEvents.slice(0, 20)) {
            console.log(`${e.ticker}`);
            console.log(`  ${e.title?.slice(0, 60)}`);
            console.log(`  Status: ${e.status} | Close: ${e.close_time}`);
            console.log();
        }
    }
}

main().catch(console.error);
