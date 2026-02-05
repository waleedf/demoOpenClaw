/**
 * Technical Indicator Calculations
 * Shared utility functions for calculating technical indicators
 */

const axios = require('axios');

// CoinGecko API base URL
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Symbol mapping (CoinGecko uses different IDs)
const SYMBOL_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'DOGE': 'dogecoin'
};

// Calculate Simple Moving Average
function calculateSMA(data, period) {
  if (data.length < period) return null;
  const sum = data.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

// Calculate Exponential Moving Average
function calculateEMA(data, period) {
  if (data.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);

  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  return ema;
}

// Calculate RSI (Relative Strength Index)
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;

  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

  const avgGain = calculateSMA(gains, period);
  const avgLoss = calculateSMA(losses, period);

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

// Calculate MACD (Moving Average Convergence Divergence)
function calculateMACD(closes) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  if (!ema12 || !ema26) return null;

  const macdLine = ema12 - ema26;

  // For signal line, we'd need to calculate EMA of MACD line
  // Simplified version here
  return {
    macd: macdLine,
    signal: null, // Would need more data points
    histogram: null
  };
}

// Calculate Bollinger Bands
function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  if (closes.length < period) return null;

  const sma = calculateSMA(closes, period);
  const recentPrices = closes.slice(-period);

  // Calculate standard deviation
  const squaredDiffs = recentPrices.map(price => Math.pow(price - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const standardDeviation = Math.sqrt(variance);

  return {
    upper: sma + (standardDeviation * stdDev),
    middle: sma,
    lower: sma - (standardDeviation * stdDev)
  };
}

// Fetch OHLCV data from CoinGecko
async function getPriceData(symbol, timeframe = '1h', limit = 100) {
  try {
    const coinId = SYMBOL_MAP[symbol] || symbol.toLowerCase();

    // CoinGecko returns daily data, we'll use that for now
    const days = Math.min(limit, 365);
    const url = `${COINGECKO_API}/coins/${coinId}/market_chart`;

    const response = await axios.get(url, {
      params: {
        vs_currency: 'usd',
        days: days,
        interval: 'daily'
      }
    });

    const prices = response.data.prices;

    return prices.map((point, i) => ({
      timestamp: point[0],
      open: point[1], // CoinGecko doesn't provide OHLC, only price
      high: point[1],
      low: point[1],
      close: point[1],
      volume: response.data.total_volumes[i]?.[1] || 0
    }));
  } catch (error) {
    throw new Error(`Failed to fetch price data: ${error.message}`);
  }
}

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  getPriceData,
  SYMBOL_MAP,
  COINGECKO_API
};
