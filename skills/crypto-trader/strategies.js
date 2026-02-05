/**
 * Trading Strategy Definitions
 * Multiple technical analysis strategies for comparison
 */

const { runBacktest } = require('./backtest.js');

/**
 * Strategy 1: Current (RSI + MACD + 3 Moving Averages)
 * Balanced approach with multiple confirmation signals
 */
const STRATEGY_CURRENT = {
  name: "Current (RSI14 + MACD + 3 MAs)",
  indicators: {
    rsi: { period: 14, oversold: 40, overbought: 60 },
    macd: { fast: 12, slow: 26, signal: 9 },
    ma: { short: 20, medium: 50, long: 200 }
  },
  rules: {
    buy: [
      { type: 'rsi', condition: 'below', value: 40 }
    ],
    sell: [
      { type: 'rsi', condition: 'above', value: 60 }
    ]
  }
};

/**
 * Strategy 2: Aggressive (Shorter periods for faster signals)
 * Trades more frequently with quicker reactions
 */
const STRATEGY_AGGRESSIVE = {
  name: "Aggressive (RSI10 + Short MAs)",
  indicators: {
    rsi: { period: 10, oversold: 35, overbought: 65 },
    macd: { fast: 8, slow: 17, signal: 9 },
    ma: { short: 10, medium: 30, long: 100 }
  },
  rules: {
    buy: [
      { type: 'rsi', condition: 'below', value: 35 },
      { type: 'macd', condition: 'bullishCross' },
      { type: 'price', condition: 'above', indicator: 'ma20' }
    ],
    sell: [
      { type: 'rsi', condition: 'above', value: 65 },
      { type: 'macd', condition: 'bearishCross' }
    ]
  }
};

/**
 * Strategy 3: Conservative (Longer periods, fewer trades)
 * Waits for stronger confirmation signals
 */
const STRATEGY_CONSERVATIVE = {
  name: "Conservative (RSI20 + Long MAs)",
  indicators: {
    rsi: { period: 20, oversold: 25, overbought: 75 },
    macd: { fast: 12, slow: 26, signal: 9 },
    ma: { short: 50, medium: 100, long: 200 }
  },
  rules: {
    buy: [
      { type: 'rsi', condition: 'below', value: 25 },
      { type: 'macd', condition: 'bullishCross' },
      { type: 'price', condition: 'above', indicator: 'ma20' }
    ],
    sell: [
      { type: 'rsi', condition: 'above', value: 75 },
      { type: 'macd', condition: 'bearishCross' }
    ]
  }
};

/**
 * Strategy 4: Momentum Only (Pure MACD focus)
 * Rides strong trends regardless of overbought/oversold
 */
const STRATEGY_MOMENTUM = {
  name: "Momentum (MACD + Volume)",
  indicators: {
    rsi: { period: 14, oversold: 30, overbought: 70 }, // Not used in rules
    macd: { fast: 12, slow: 26, signal: 9 },
    ma: { short: 20, medium: 50, long: 200 }
  },
  rules: {
    buy: [
      { type: 'macd', condition: 'bullishCross' },
      { type: 'price', condition: 'above', indicator: 'ma20' }
    ],
    sell: [
      { type: 'macd', condition: 'bearishCross' }
    ]
  }
};

/**
 * Strategy 5: Mean Reversion (Bollinger Bands + RSI)
 * Buys oversold, sells overbought (counter-trend)
 */
const STRATEGY_MEAN_REVERSION = {
  name: "Mean Reversion (BB + RSI)",
  indicators: {
    rsi: { period: 14, oversold: 20, overbought: 80 },
    macd: { fast: 12, slow: 26, signal: 9 },
    ma: { short: 20, medium: 50, long: 200 }
  },
  rules: {
    buy: [
      { type: 'rsi', condition: 'below', value: 20 },
      { type: 'price', condition: 'above', indicator: 'ma20' }
    ],
    sell: [
      { type: 'rsi', condition: 'above', value: 80 }
    ]
  }
};

/**
 * All strategies mapped by name
 */
const STRATEGIES = {
  'current': STRATEGY_CURRENT,
  'aggressive': STRATEGY_AGGRESSIVE,
  'conservative': STRATEGY_CONSERVATIVE,
  'momentum': STRATEGY_MOMENTUM,
  'mean-reversion': STRATEGY_MEAN_REVERSION
};

/**
 * Compare multiple strategies on the same data
 */
async function compareStrategies(symbol, startDate, endDate) {
  const strategies = [
    STRATEGY_CURRENT,
    STRATEGY_AGGRESSIVE,
    STRATEGY_CONSERVATIVE,
    STRATEGY_MOMENTUM,
    STRATEGY_MEAN_REVERSION
  ];

  const results = [];

  for (const strategy of strategies) {
    try {
      const result = await runBacktest(symbol, startDate, endDate, strategy);
      results.push({
        name: strategy.name,
        totalReturn: result.totalReturn,
        winRate: result.winRate,
        sharpeRatio: parseFloat(result.sharpeRatio),
        maxDrawdown: result.maxDrawdown,
        trades: result.totalTrades,
        buyHoldReturn: result.buyHoldReturn
      });
    } catch (error) {
      console.error(`Strategy ${strategy.name} failed:`, error.message);
    }
  }

  // Sort by Sharpe ratio (risk-adjusted return)
  results.sort((a, b) => b.sharpeRatio - a.sharpeRatio);

  return results;
}

module.exports = {
  STRATEGIES,
  STRATEGY_CURRENT,
  STRATEGY_AGGRESSIVE,
  STRATEGY_CONSERVATIVE,
  STRATEGY_MOMENTUM,
  STRATEGY_MEAN_REVERSION,
  compareStrategies
};
