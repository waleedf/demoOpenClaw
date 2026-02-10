#!/usr/bin/env node
/**
 * Kalshi PRODUCTION API Test
 * Real money environment.
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

// PRODUCTION environment config
const BASE_URL = 'api.elections.kalshi.com';
const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY_PATH = '/data/workspace/.keys/kalshi_private_key.pem';

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

function signRequest(timestampMs, method, path, body = '') {
    const message = `${timestampMs}${method}${path}${body}`;
    const signature = crypto.sign('sha256', Buffer.from(message), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN
    });
    return signature.toString('base64');
}

function makeRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const body = data ? JSON.stringify(data) : '';
        const signature = signRequest(timestampMs, method, path, body);

        const options = {
            hostname: BASE_URL,
            port: 443,
            path: path,
            method: method,
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(responseData) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    console.log('='.repeat(60));
    console.log('KALSHI PRODUCTION API TEST');
    console.log('⚠️  REAL MONEY ENVIRONMENT');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${new Date().toISOString()}`);

    // Check balance
    console.log('\n📊 Checking account balance...');
    const balanceRes = await makeRequest('GET', '/portfolio/balance');
    if (balanceRes.status === 200) {
        const balanceCents = balanceRes.data.balance || 0;
        console.log(`   ✅ Balance: $${(balanceCents / 100).toFixed(2)}`);
    } else {
        console.log(`   ❌ Error: ${balanceRes.status} - ${JSON.stringify(balanceRes.data)}`);
        return;
    }

    // Check positions
    console.log('\n📈 Checking open positions...');
    const posRes = await makeRequest('GET', '/portfolio/positions');
    if (posRes.status === 200) {
        const positions = posRes.data.market_positions || [];
        if (positions.length > 0) {
            console.log(`   ✅ Found ${positions.length} position(s):`);
            positions.forEach(pos => {
                console.log(`      - ${pos.ticker}: ${pos.position} contracts @ avg ${pos.average_price}¢`);
            });
        } else {
            console.log('   ✅ No open positions');
        }
    }

    // Find BTC daily threshold markets
    console.log('\n🔍 Searching for BTC daily threshold markets...');
    const marketsRes = await makeRequest('GET', '/markets?limit=100&status=open');
    if (marketsRes.status === 200) {
        const markets = marketsRes.data.markets || [];

        const btcDailyMarkets = markets.filter(m =>
            m.ticker?.includes('KXBTC') &&
            !m.ticker?.includes('15M') &&
            !m.ticker?.includes('1H')
        );

        const allBtcMarkets = markets.filter(m =>
            m.ticker?.toUpperCase().includes('BTC') ||
            m.title?.toLowerCase().includes('bitcoin')
        );

        console.log(`   Total open markets: ${markets.length}`);
        console.log(`   BTC-related markets: ${allBtcMarkets.length}`);
        console.log(`   BTC daily threshold markets: ${btcDailyMarkets.length}`);

        if (allBtcMarkets.length > 0) {
            console.log('\n   🪙 BTC Markets found:');
            allBtcMarkets.slice(0, 10).forEach(m => {
                console.log(`      - ${m.ticker}`);
                console.log(`        ${m.title?.slice(0, 70)}`);
                console.log(`        Bid: ${m.yes_bid}¢ | Ask: ${m.yes_ask}¢ | Vol: ${m.volume} | Liquidity: ${m.open_interest || 'N/A'}`);
                console.log(`        Close: ${m.close_time}`);
                console.log();
            });
        }

        const byVolume = [...markets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
        console.log('\n   📊 Top 5 markets by volume:');
        byVolume.slice(0, 5).forEach(m => {
            console.log(`      - ${m.ticker}: Vol ${m.volume} | ${m.title?.slice(0, 50)}...`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('PRODUCTION TEST COMPLETE');
    console.log('='.repeat(60));
}

main().catch(console.error);
