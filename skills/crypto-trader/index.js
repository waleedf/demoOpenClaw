#!/usr/bin/env node
/**
 * Crypto Trader - Technical Analysis Skill
 * Provides market data and technical indicators for cryptocurrency trading
 */

const axios = require('axios');
const {
  getPriceData,
  calculateRSI,
  calculateSMA,
  calculateEMA,
  calculateMACD,
  calculateBollingerBands,
  SYMBOL_MAP,
  COINGECKO_API
} = require('./indicators.js');

/**
 * Market Data Functions
 */

// Get current market overview
async function getMarketOverview(symbols) {
  try {
    const symbolArray = symbols.split(',').map(s => s.trim());
    const coinIds = symbolArray.map(s => SYMBOL_MAP[s] || s.toLowerCase()).join(',');

    const url = `${COINGECKO_API}/coins/markets`;
    const response = await axios.get(url, {
      params: {
        vs_currency: 'usd',
        ids: coinIds,
        order: 'market_cap_desc',
        sparkline: false
      }
    });

    return response.data.map(coin => ({
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      volume24h: coin.total_volume,
      high24h: coin.high_24h,
      low24h: coin.low_24h,
      marketCap: coin.market_cap
    }));
  } catch (error) {
    throw new Error(`Failed to fetch market overview: ${error.message}`);
  }
}

// Comprehensive technical analysis
async function analyzeChart(symbol) {
  try {
    const data = await getPriceData(symbol, '1d', 200);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    const currentPrice = closes[closes.length - 1];

    // Calculate all indicators
    const rsi = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);
    const ma20 = calculateSMA(closes, 20);
    const ma50 = calculateSMA(closes, 50);
    const ma200 = calculateSMA(closes, 200);
    const bb = calculateBollingerBands(closes, 20, 2);

    // Volume analysis
    const avgVolume = calculateSMA(volumes, 20);
    const currentVolume = volumes[volumes.length - 1];
    const volumeTrend = currentVolume > avgVolume ? 'increasing' : 'decreasing';

    // Determine signal
    let signal = 'HOLD';
    let confidence = 50;
    let reasoning = [];

    // RSI analysis
    if (rsi < 30) {
      reasoning.push('RSI oversold (potential buy)');
      confidence += 10;
      signal = 'BUY';
    } else if (rsi > 70) {
      reasoning.push('RSI overbought (potential sell)');
      confidence += 10;
      signal = 'SELL';
    } else {
      reasoning.push(`RSI neutral (${rsi.toFixed(1)})`);
    }

    // MA trend analysis
    const trendScore = (currentPrice > ma20 ? 1 : 0) +
                       (currentPrice > ma50 ? 1 : 0) +
                       (currentPrice > ma200 ? 1 : 0);

    if (trendScore >= 2) {
      reasoning.push('Price above major MAs (bullish trend)');
      if (signal !== 'SELL') {
        signal = 'BUY';
        confidence += 15;
      }
    } else if (trendScore <= 1) {
      reasoning.push('Price below major MAs (bearish trend)');
      if (signal !== 'BUY') {
        signal = 'SELL';
        confidence += 15;
      }
    }

    // Volume confirmation
    if (volumeTrend === 'increasing' && signal === 'BUY') {
      reasoning.push('Volume confirming uptrend');
      confidence += 10;
    }

    // Calculate support/resistance
    const recentLows = data.slice(-20).map(d => d.low);
    const recentHighs = data.slice(-20).map(d => d.high);
    const support = Math.min(...recentLows);
    const resistance = Math.max(...recentHighs);

    return {
      symbol,
      currentPrice,
      timestamp: new Date().toISOString(),
      indicators: {
        rsi: rsi?.toFixed(2),
        macd: macd?.macd?.toFixed(2),
        ma20: ma20?.toFixed(2),
        ma50: ma50?.toFixed(2),
        ma200: ma200?.toFixed(2),
        bollingerBands: {
          upper: bb?.upper?.toFixed(2),
          middle: bb?.middle?.toFixed(2),
          lower: bb?.lower?.toFixed(2)
        }
      },
      volumeTrend,
      support: support?.toFixed(2),
      resistance: resistance?.toFixed(2),
      signal,
      confidence: Math.min(confidence, 100),
      reasoning: reasoning.join('. ')
    };
  } catch (error) {
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

/**
 * CLI Interface
 */

const fs = require('fs');
const path = require('path');
const { runBacktest } = require('./backtest.js');
const { STRATEGIES, compareStrategies } = require('./strategies.js');
const { notifySignalChange, notifyPriceAlert, notifyBacktestResults, notifyStrategyComparison } = require('./notify.js');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'get-price-data': {
        const [, symbol, timeframe = '1d', limit = '100'] = args;
        if (!symbol) throw new Error('Symbol required');
        const data = await getPriceData(symbol, timeframe, parseInt(limit));
        console.log(JSON.stringify(data, null, 2));
        break;
      }

      case 'get-market-overview': {
        const [, symbols] = args;
        if (!symbols) throw new Error('Symbols required (comma-separated)');
        const data = await getMarketOverview(symbols);
        console.log(JSON.stringify(data, null, 2));
        break;
      }

      case 'analyze-chart': {
        const [, symbol] = args;
        if (!symbol) throw new Error('Symbol required');
        const analysis = await analyzeChart(symbol);
        console.log(JSON.stringify(analysis, null, 2));
        break;
      }

      case 'calculate-rsi': {
        const [, symbol, period = '14'] = args;
        if (!symbol) throw new Error('Symbol required');
        const data = await getPriceData(symbol, '1d', 100);
        const closes = data.map(d => d.close);
        const rsi = calculateRSI(closes, parseInt(period));
        console.log(JSON.stringify({ symbol, rsi: rsi?.toFixed(2), period }, null, 2));
        break;
      }

      case 'backtest': {
        const [, symbol = 'BTC', strategyName = 'current'] = args;

        if (!STRATEGIES[strategyName]) {
          throw new Error(`Unknown strategy: ${strategyName}. Available: ${Object.keys(STRATEGIES).join(', ')}`);
        }

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        console.log(`Running backtest for ${symbol} using ${strategyName} strategy...`);

        const result = await runBacktest(
          symbol,
          sixMonthsAgo.toISOString().split('T')[0],
          new Date().toISOString().split('T')[0],
          STRATEGIES[strategyName]
        );

        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'compare-strategies': {
        const [, symbol = 'BTC'] = args;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        console.log(`Comparing strategies for ${symbol}...\\n`);

        const results = await compareStrategies(
          symbol,
          sixMonthsAgo.toISOString().split('T')[0],
          new Date().toISOString().split('T')[0]
        );

        console.log('Strategy Comparison Results:\\n');
        results.forEach((r, i) => {
          console.log(`${i + 1}. ${r.name}`);
          console.log(`   Return: ${r.totalReturn}`);
          console.log(`   Win Rate: ${r.winRate}`);
          console.log(`   Sharpe: ${r.sharpeRatio.toFixed(2)}`);
          console.log(`   Max DD: ${r.maxDrawdown}`);
          console.log(`   Trades: ${r.trades}\\n`);
        });

        break;
      }

      case 'monitor': {
        const [, symbols = 'BTC,ETH,SOL'] = args;
        const symbolArray = symbols.split(',').map(s => s.trim());

        // Load previous signals from state file
        const stateFile = path.join(process.env.HOME, '.openclaw/workspace/.state/crypto-signals.json');
        let previousSignals = {};

        if (fs.existsSync(stateFile)) {
          previousSignals = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        }

        const alerts = [];

        for (const symbol of symbolArray) {
          try {
            const analysis = await analyzeChart(symbol);
            const prevData = previousSignals[symbol];

            // Check for signal change
            if (prevData && prevData.signal !== analysis.signal) {
              await notifySignalChange(symbol, prevData.signal, analysis.signal, analysis);
              alerts.push(`${symbol}: Signal changed ${prevData.signal}→${analysis.signal}`);
            }

            // Check for big price move (>5%)
            if (prevData && prevData.price) {
              const priceChange = ((analysis.currentPrice - prevData.price) / prevData.price) * 100;
              if (Math.abs(priceChange) > 5) {
                await notifyPriceAlert(symbol, priceChange, analysis);
                alerts.push(`${symbol}: ${priceChange.toFixed(1)}% move`);
              }
            }

            // Update state
            previousSignals[symbol] = {
              signal: analysis.signal,
              price: analysis.currentPrice,
              timestamp: new Date().toISOString()
            };
          } catch (error) {
            console.error(`Failed to analyze ${symbol}:`, error.message);
          }
        }

        // Save updated state
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(stateFile, JSON.stringify(previousSignals, null, 2));

        // Return summary
        console.log(JSON.stringify({
          status: alerts.length > 0 ? 'ALERTS' : 'OK',
          alerts: alerts,
          timestamp: new Date().toISOString()
        }, null, 2));

        break;
      }

      default:
        console.log('Crypto Trader CLI');
        console.log('\\nCommands:');
        console.log('  get-price-data <symbol> [timeframe] [limit]');
        console.log('  get-market-overview <symbols>');
        console.log('  analyze-chart <symbol>');
        console.log('  calculate-rsi <symbol> [period]');
        console.log('  backtest <symbol> <strategy>');
        console.log('  compare-strategies <symbol>');
        console.log('  monitor <symbols>');
        console.log('\\nExamples:');
        console.log('  node index.js analyze-chart BTC');
        console.log('  node index.js backtest BTC current');
        console.log('  node index.js compare-strategies ETH');
        console.log('  node index.js monitor BTC,ETH,SOL');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getPriceData,
  getMarketOverview,
  analyzeChart,
  calculateRSI,
  calculateSMA,
  calculateEMA,
  calculateMACD,
  calculateBollingerBands
};
