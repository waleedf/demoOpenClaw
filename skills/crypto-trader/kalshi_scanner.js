#!/usr/bin/env node
/**
 * Kalshi Crypto Market Scanner
 * Scans for divergences between market price and fair value
 * Alerts when edge > threshold
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const API_KEY_ID = 'fedaa700-afc2-4646-93d5-b2b491735d6e';
const PRIVATE_KEY = fs.readFileSync('/data/workspace/.keys/kalshi_private_key.pem', 'utf8');
const EDGE_THRESHOLD = 0.05; // 5% minimum edge (10% for <1h expiry)
const VOL_BTC = 0.58;  // Realized vol from Binance hourly data (Feb 2026)
const VOL_ETH = 0.80;  // Realized vol from Binance hourly data (Feb 2026)
const SHORT_EXPIRY_VOL_MULT = 1.3;  // Vol penalty for <1h expiry (wicks/cascades)
const SHORT_EXPIRY_HOURS = 1.0;
const SHORT_EXPIRY_EDGE_MIN = 0.10;  // 10% min edge for <1h

function signRequest(timestampMs, method, path) {
    return crypto.sign('sha256', Buffer.from(`${timestampMs}${method}${path}`), {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    }).toString('base64');
}

function api(endpoint) {
    return new Promise((resolve, reject) => {
        const timestampMs = Date.now().toString();
        const path = `/trade-api/v2${endpoint}`;
        const req = https.request({
            hostname: 'api.elections.kalshi.com',
            port: 443, path, method: 'GET',
            headers: {
                'KALSHI-ACCESS-KEY': API_KEY_ID,
                'KALSHI-ACCESS-TIMESTAMP': timestampMs,
                'KALSHI-ACCESS-SIGNATURE': signRequest(timestampMs, 'GET', path),
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(d)); }
                catch { resolve(null); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function getPrice(coin) {
    // Primary: Binance (most reliable)
    const binanceSymbol = coin === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';

    return new Promise((resolve) => {
        // Try Binance first
        https.get(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`, (res) => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                try {
                    const price = parseFloat(JSON.parse(d).price);
                    if (price > 0) return resolve(price);
                } catch {}
                // Fallback to Coinbase
                https.get(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, (res2) => {
                    let d2 = '';
                    res2.on('data', chunk => d2 += chunk);
                    res2.on('end', () => {
                        try { resolve(parseFloat(JSON.parse(d2).data?.amount)); }
                        catch { resolve(null); }
                    });
                }).on('error', () => resolve(null));
            });
        }).on('error', () => {
            // Fallback to Coinbase on error
            https.get(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, (res2) => {
                let d2 = '';
                res2.on('data', chunk => d2 += chunk);
                res2.on('end', () => {
                    try { resolve(parseFloat(JSON.parse(d2).data?.amount)); }
                    catch { resolve(null); }
                });
            }).on('error', () => resolve(null));
        });
    });
}

function normcdf(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
}

function bucketProb(current, lower, upper, vol, hours) {
    if (hours <= 0) return 0;
    const timeYears = hours / (24 * 365);
    const sigma = vol * Math.sqrt(timeYears);
    const mu = -0.5 * sigma * sigma;
    const d_upper = (Math.log(upper / current) - mu) / sigma;
    const d_lower = (Math.log(lower / current) - mu) / sigma;
    return normcdf(d_upper) - normcdf(d_lower);
}

function aboveProb(current, threshold, vol, hours) {
    if (hours <= 0) return current > threshold ? 1 : 0;
    const timeYears = hours / (24 * 365);
    const sigma = vol * Math.sqrt(timeYears);
    const mu = -0.5 * sigma * sigma;
    const d = (Math.log(threshold / current) - mu) / sigma;
    return 1 - normcdf(d);
}

async function scanSeries(series, price, vol) {
    const opportunities = [];
    const res = await api(`/markets?series_ticker=${series}&status=open&limit=200`);

    if (!res?.markets) return opportunities;

    const now = new Date();

    for (const m of res.markets) {
        const closeTime = new Date(m.close_time);
        const hoursLeft = (closeTime - now) / (1000 * 60 * 60);

        if (hoursLeft < 0.25 || hoursLeft > 168) continue; // Skip <15min or >1week

        let fairProb = null;
        let betType = null;

        // Apply short-expiry vol penalty
        const effectiveVol = hoursLeft < SHORT_EXPIRY_HOURS ? vol * SHORT_EXPIRY_VOL_MULT : vol;
        const minEdge = hoursLeft < SHORT_EXPIRY_HOURS ? SHORT_EXPIRY_EDGE_MIN : EDGE_THRESHOLD;

        // Bucket markets
        const bucketMatch = m.subtitle?.match(/\$([\d,]+)\s+to\s+([\d,]+)/);
        if (bucketMatch) {
            const lower = parseFloat(bucketMatch[1].replace(/,/g, ''));
            const upper = parseFloat(bucketMatch[2].replace(/,/g, ''));
            fairProb = bucketProb(price, lower, upper, effectiveVol, hoursLeft);
            betType = 'bucket';
        }

        // Above threshold
        const aboveMatch = m.subtitle?.match(/\$([\d,]+(?:\.\d+)?)\s+or\s+above/);
        if (aboveMatch) {
            const threshold = parseFloat(aboveMatch[1].replace(/,/g, ''));
            fairProb = aboveProb(price, threshold, effectiveVol, hoursLeft);
            betType = 'above';
        }

        // Below threshold
        const belowMatch = m.subtitle?.match(/\$([\d,]+(?:\.\d+)?)\s+or\s+below/);
        if (belowMatch) {
            const threshold = parseFloat(belowMatch[1].replace(/,/g, ''));
            fairProb = 1 - aboveProb(price, threshold, effectiveVol, hoursLeft);
            betType = 'below';
        }

        if (fairProb === null) continue;

        const yesAsk = (m.yes_ask || 100) / 100;
        const yesBid = (m.yes_bid || 0) / 100;
        const noAsk = (m.no_ask || 100) / 100;

        const edgeYes = fairProb - yesAsk;
        const edgeNo = (1 - fairProb) - noAsk;

        if (edgeYes > minEdge) {
            opportunities.push({
                ticker: m.ticker,
                subtitle: m.subtitle,
                side: 'YES',
                price: yesAsk,
                fairProb,
                edge: edgeYes,
                hoursLeft,
                volume: m.volume
            });
        }

        if (edgeNo > minEdge && noAsk < 0.98) {
            opportunities.push({
                ticker: m.ticker,
                subtitle: m.subtitle,
                side: 'NO',
                price: noAsk,
                fairProb: 1 - fairProb,
                edge: edgeNo,
                hoursLeft,
                volume: m.volume
            });
        }
    }

    return opportunities;
}

async function main() {
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`KALSHI CRYPTO SCANNER - ${timestamp}`);
    console.log('='.repeat(60));

    // Get prices
    const btc = await getPrice('BTC');
    const eth = await getPrice('ETH');

    if (!btc || !eth) {
        console.log('ERROR: Could not fetch prices');
        return { opportunities: [], error: 'price_fetch_failed' };
    }

    console.log(`\nBTC: $${btc.toLocaleString()} | ETH: $${eth.toLocaleString()}`);

    // Scan markets
    const allOpportunities = [];

    console.log('\nScanning BTC markets...');
    const btcOpps = await scanSeries('KXBTC', btc, VOL_BTC);
    allOpportunities.push(...btcOpps);

    console.log('Scanning ETH markets...');
    const ethOpps = await scanSeries('KXETH', eth, VOL_ETH);
    allOpportunities.push(...ethOpps);

    // Sort by edge
    allOpportunities.sort((a, b) => b.edge - a.edge);

    // Output
    if (allOpportunities.length === 0) {
        console.log('\n✓ No opportunities with >5% edge found');
        console.log(JSON.stringify({ timestamp, btc, eth, opportunities: [] }));
        return { opportunities: [] };
    }

    console.log(`\n🎯 FOUND ${allOpportunities.length} OPPORTUNITIES:\n`);

    for (const opp of allOpportunities.slice(0, 10)) {
        console.log(`${opp.side} ${opp.ticker}`);
        console.log(`  "${opp.subtitle}"`);
        console.log(`  Price: ${(opp.price * 100).toFixed(0)}¢ | Fair: ${(opp.fairProb * 100).toFixed(1)}% | Edge: ${(opp.edge * 100).toFixed(1)}%`);
        console.log(`  Expires: ${opp.hoursLeft.toFixed(1)}h | Volume: ${opp.volume}`);
        console.log();
    }

    // Return structured data for cron
    const result = {
        timestamp,
        btc,
        eth,
        opportunities: allOpportunities.slice(0, 10)
    };

    console.log('\n--- JSON OUTPUT ---');
    console.log(JSON.stringify(result, null, 2));

    return result;
}

main().catch(console.error);
