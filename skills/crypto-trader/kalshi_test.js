#!/usr/bin/env node
/**
 * Kalshi Demo API Test Script
 * Tests basic connectivity and operations on the demo environment.
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

// Demo environment config
const BASE_URL = 'demo-api.kalshi.co';
const API_KEY_ID = '3ac0693e-1abb-4b70-b9bb-571fd20630ef';
const PRIVATE_KEY_PATH = '/data/workspace/.keys/kalshi_demo_key.pem';

// Load private key
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

function signRequest(timestampMs, method, path, body = '') {
    const message = `${timestampMs}${method}${path}${body}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();

    // RSA-PSS padding
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
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(responseData)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function testBalance() {
    console.log('\n📊 Checking account balance...');
    try {
        const response = await makeRequest('GET', '/portfolio/balance');
        if (response.status === 200) {
            const balanceCents = response.data.balance || 0;
            console.log(`   ✅ Balance: $${(balanceCents / 100).toFixed(2)}`);
            return balanceCents;
        } else {
            console.log(`   ❌ Error: ${response.status} - ${JSON.stringify(response.data)}`);
            return null;
        }
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
        return null;
    }
}

async function testPositions() {
    console.log('\n📈 Checking open positions...');
    try {
        const response = await makeRequest('GET', '/portfolio/positions');
        if (response.status === 200) {
            const positions = response.data.market_positions || [];
            if (positions.length > 0) {
                console.log(`   ✅ Found ${positions.length} position(s):`);
                positions.slice(0, 5).forEach(pos => {
                    console.log(`      - ${pos.ticker}: ${pos.position} contracts`);
                });
            } else {
                console.log('   ✅ No open positions');
            }
            return positions;
        } else {
            console.log(`   ❌ Error: ${response.status} - ${JSON.stringify(response.data)}`);
            return null;
        }
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
        return null;
    }
}

async function testMarkets() {
    console.log('\n🔍 Fetching open markets...');
    try {
        const response = await makeRequest('GET', '/markets?limit=50&status=open');
        if (response.status === 200) {
            const markets = response.data.markets || [];
            console.log(`   ✅ Found ${markets.length} open markets`);

            // Look for BTC/crypto markets
            const btcMarkets = markets.filter(m =>
                m.ticker?.toUpperCase().includes('BTC') ||
                m.title?.toLowerCase().includes('bitcoin') ||
                m.ticker?.toUpperCase().includes('KXBTC')
            );

            if (btcMarkets.length > 0) {
                console.log(`\n   🪙 BTC Markets (${btcMarkets.length}):`);
                btcMarkets.slice(0, 5).forEach(m => {
                    console.log(`      - ${m.ticker}`);
                    console.log(`        ${m.title?.slice(0, 60)}...`);
                    console.log(`        Bid: ${m.yes_bid}¢ | Ask: ${m.yes_ask}¢ | Vol: ${m.volume}`);
                });
            } else {
                console.log('\n   ⚠️  No BTC markets found. Sample markets:');
                markets.slice(0, 5).forEach(m => {
                    console.log(`      - ${m.ticker}: ${m.title?.slice(0, 50)}...`);
                });
            }

            return { markets, btcMarkets };
        } else {
            console.log(`   ❌ Error: ${response.status} - ${JSON.stringify(response.data)}`);
            return null;
        }
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
        return null;
    }
}

async function testOrderbook(ticker) {
    console.log(`\n📚 Getting orderbook for ${ticker}...`);
    try {
        const response = await makeRequest('GET', `/markets/${ticker}/orderbook`);
        if (response.status === 200) {
            const orderbook = response.data.orderbook || {};
            const yesBids = (orderbook.yes || []).slice(0, 3);
            const noBids = (orderbook.no || []).slice(0, 3);

            console.log('   ✅ Top YES bids:');
            yesBids.forEach(bid => {
                console.log(`      ${bid[0]}¢ x ${bid[1]} contracts`);
            });

            console.log('   Top NO bids (YES asks):');
            noBids.forEach(bid => {
                console.log(`      ${100 - bid[0]}¢ x ${bid[1]} contracts`);
            });

            return orderbook;
        } else {
            console.log(`   ❌ Error: ${response.status} - ${JSON.stringify(response.data)}`);
            return null;
        }
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
        return null;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('KALSHI DEMO API TEST');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('Environment: Demo (demo-api.kalshi.co)');

    const balance = await testBalance();
    const positions = await testPositions();
    const marketData = await testMarkets();

    // Test orderbook on first BTC market found, or first market
    if (marketData) {
        const ticker = marketData.btcMarkets?.[0]?.ticker || marketData.markets?.[0]?.ticker;
        if (ticker) {
            await testOrderbook(ticker);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));
}

main().catch(console.error);
