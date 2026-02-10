#!/usr/bin/env node
/**
 * Crypto Options Volatility Scanner
 * Uses Deribit API (free) for BTC/ETH options data
 * Compares Implied Vol vs Realized Vol to find mispricings
 */

const https = require('https');

// Config
const ASSETS = ['BTC', 'ETH'];
const IV_RV_SELL_THRESHOLD = 1.3;  // IV/RV > 1.3 = sell vol
const IV_RV_BUY_THRESHOLD = 0.7;   // IV/RV < 0.7 = buy vol
const MIN_DTE = 7;
const MAX_DTE = 45;
const RV_LOOKBACK_DAYS = 30;

// Deribit API helper
function deribitGet(endpoint) {
    return new Promise((resolve, reject) => {
        const url = 'https://www.deribit.com/api/v2/public/' + endpoint;
        https.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) reject(new Error(parsed.error.message));
                    else resolve(parsed.result);
                } catch (e) {
                    reject(new Error(`Parse error: ${data.slice(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}

// Calculate realized volatility from hourly candles
function calculateRealizedVol(candles) {
    if (!candles || candles.length < 24) return null;

    // Use close prices
    const prices = candles.map(c => c.close);

    // Calculate hourly returns
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i-1] > 0) {
            returns.push(Math.log(prices[i] / prices[i-1]));
        }
    }

    if (returns.length < 24) return null;

    // Calculate volatility
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const hourlyVol = Math.sqrt(variance);

    // Annualize (8760 hours in a year)
    const annualizedVol = hourlyVol * Math.sqrt(8760);

    return annualizedVol;
}

// Get historical candles for realized vol calculation
async function getHistoricalVol(currency) {
    const now = Date.now();
    const start = now - (RV_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const endpoint = `get_tradingview_chart_data?instrument_name=${currency}-PERPETUAL&resolution=60&start_timestamp=${start}&end_timestamp=${now}`;

    try {
        const data = await deribitGet(endpoint);

        const candles = [];
        for (let i = 0; i < data.close.length; i++) {
            candles.push({
                close: data.close[i],
                high: data.high[i],
                low: data.low[i]
            });
        }

        return calculateRealizedVol(candles);
    } catch (e) {
        console.error(`Error getting ${currency} historical data:`, e.message);
        return null;
    }
}

// Get ATM implied volatility from options
async function getImpliedVol(currency) {
    try {
        // Get index price
        const indexData = await deribitGet(`get_index_price?index_name=${currency.toLowerCase()}_usd`);
        const indexPrice = indexData.index_price;

        // Get all options
        const instruments = await deribitGet(`get_instruments?currency=${currency}&kind=option&expired=false`);

        // Filter by DTE
        const now = Date.now();
        const minExp = now + (MIN_DTE * 24 * 60 * 60 * 1000);
        const maxExp = now + (MAX_DTE * 24 * 60 * 60 * 1000);

        const validOptions = instruments.filter(i =>
            i.expiration_timestamp > minExp &&
            i.expiration_timestamp < maxExp
        );

        if (validOptions.length === 0) {
            console.log(`  No options in DTE range for ${currency}`);
            return { indexPrice, impliedVol: null };
        }

        // Find ATM options (strike closest to index price)
        const strikeStep = currency === 'BTC' ? 1000 : 50;
        const atmStrike = Math.round(indexPrice / strikeStep) * strikeStep;

        // Get closest expiration
        const sortedByExp = validOptions.sort((a, b) => a.expiration_timestamp - b.expiration_timestamp);
        const nearestExp = sortedByExp[0].expiration_timestamp;

        // Find ATM call and put for nearest expiration
        const atmOptions = validOptions.filter(i =>
            i.strike === atmStrike &&
            i.expiration_timestamp === nearestExp
        );

        if (atmOptions.length === 0) {
            // Try adjacent strikes
            const adjacentStrikes = [atmStrike - strikeStep, atmStrike + strikeStep];
            const nearbyOptions = validOptions.filter(i =>
                adjacentStrikes.includes(i.strike) &&
                i.expiration_timestamp === nearestExp
            );

            if (nearbyOptions.length === 0) {
                return { indexPrice, impliedVol: null };
            }

            const ticker = await deribitGet(`ticker?instrument_name=${nearbyOptions[0].instrument_name}`);
            const dte = (nearestExp - now) / (24 * 60 * 60 * 1000);

            return {
                indexPrice,
                impliedVol: ticker.mark_iv / 100,
                strike: nearbyOptions[0].strike,
                dte,
                instrument: nearbyOptions[0].instrument_name
            };
        }

        const ticker = await deribitGet(`ticker?instrument_name=${atmOptions[0].instrument_name}`);
        const dte = (nearestExp - now) / (24 * 60 * 60 * 1000);

        return {
            indexPrice,
            impliedVol: ticker.mark_iv / 100,
            strike: atmStrike,
            dte,
            instrument: atmOptions[0].instrument_name
        };

    } catch (e) {
        console.error(`Error getting ${currency} IV:`, e.message);
        return { indexPrice: null, impliedVol: null };
    }
}

// Analyze a single asset
async function analyzeAsset(currency) {
    process.stdout.write(`  Analyzing ${currency}...`);

    const realizedVol = await getHistoricalVol(currency);
    if (!realizedVol) {
        console.log(' ❌ No RV data');
        return null;
    }

    const ivData = await getImpliedVol(currency);
    if (!ivData.impliedVol) {
        console.log(' ❌ No IV data');
        return null;
    }

    const ivRvRatio = ivData.impliedVol / realizedVol;

    let signal = 'HOLD';
    if (ivRvRatio > IV_RV_SELL_THRESHOLD) signal = 'SELL VOL';
    else if (ivRvRatio < IV_RV_BUY_THRESHOLD) signal = 'BUY VOL';

    console.log(` ✓ IV: ${(ivData.impliedVol * 100).toFixed(1)}% | RV: ${(realizedVol * 100).toFixed(1)}% | Ratio: ${ivRvRatio.toFixed(2)} | ${signal}`);

    return {
        asset: currency,
        price: ivData.indexPrice,
        impliedVol: ivData.impliedVol,
        realizedVol,
        ivRvRatio,
        dte: ivData.dte,
        strike: ivData.strike,
        instrument: ivData.instrument,
        signal
    };
}

// Main scanner
async function scan() {
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`CRYPTO OPTIONS VOL SCANNER - ${timestamp}`);
    console.log('='.repeat(60));
    console.log(`\nSource: Deribit (free API)`);
    console.log(`Thresholds: SELL if IV/RV > ${IV_RV_SELL_THRESHOLD} | BUY if IV/RV < ${IV_RV_BUY_THRESHOLD}`);
    console.log(`DTE range: ${MIN_DTE}-${MAX_DTE} days\n`);

    const results = [];

    for (const asset of ASSETS) {
        const result = await analyzeAsset(asset);
        if (result) results.push(result);
        await new Promise(r => setTimeout(r, 300));
    }

    results.sort((a, b) => Math.abs(b.ivRvRatio - 1) - Math.abs(a.ivRvRatio - 1));

    const signals = results.filter(r => r.signal !== 'HOLD');

    console.log(`\n${'─'.repeat(60)}`);

    if (signals.length === 0) {
        console.log('\n✓ No signals - IV/RV ratios within normal range');
    } else {
        console.log(`\n🎯 ${signals.length} SIGNAL(S) FOUND:\n`);

        for (const s of signals) {
            const edge = Math.abs(s.ivRvRatio - 1) * 100;
            console.log(`${s.signal}: ${s.asset}`);
            console.log(`  Price: $${s.price.toFixed(2)} | Strike: $${s.strike} | DTE: ${s.dte.toFixed(0)}`);
            console.log(`  IV: ${(s.impliedVol * 100).toFixed(1)}% | RV: ${(s.realizedVol * 100).toFixed(1)}%`);
            console.log(`  IV/RV: ${s.ivRvRatio.toFixed(2)} | Edge: ${edge.toFixed(0)}%`);
            console.log(`  Instrument: ${s.instrument}`);
            console.log();
        }
    }

    console.log('─'.repeat(60));
    console.log('SUMMARY:');
    for (const r of results) {
        const edge = ((r.ivRvRatio - 1) * 100).toFixed(0);
        const edgeSign = r.ivRvRatio > 1 ? '+' : '';
        console.log(`  ${r.asset}: IV ${(r.impliedVol * 100).toFixed(1)}% vs RV ${(r.realizedVol * 100).toFixed(1)}% (${edgeSign}${edge}% ${r.ivRvRatio > 1 ? 'rich' : 'cheap'})`);
    }

    console.log('\n--- JSON OUTPUT ---');
    console.log(JSON.stringify({
        timestamp,
        results: results.map(r => ({
            asset: r.asset,
            price: r.price,
            strike: r.strike,
            dte: Math.round(r.dte),
            impliedVol: (r.impliedVol * 100).toFixed(1) + '%',
            realizedVol: (r.realizedVol * 100).toFixed(1) + '%',
            ivRvRatio: r.ivRvRatio.toFixed(2),
            signal: r.signal,
            instrument: r.instrument
        })),
        signals: signals.map(s => s.asset)
    }, null, 2));

    return { results, signals };
}

scan().catch(console.error);
