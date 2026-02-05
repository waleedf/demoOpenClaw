/**
 * Backtesting Engine
 * Simulates trading strategies on historical data
 */

const { getPriceData, calculateRSI, calculateSMA, calculateMACD } = require('./indicators.js');
const stats = require('simple-statistics');
const fs = require('fs');
const path = require('path');

/**
 * Calculate all technical indicators for historical data
 */
function calculateIndicators(data, strategy) {
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume);
  const results = [];

  for (let i = 0; i < data.length; i++) {
    const closesUpToI = closes.slice(0, i + 1);
    const volumesUpToI = volumes.slice(0, i + 1);

    const indicators = {
      rsi: calculateRSI(closesUpToI, strategy.indicators.rsi.period),
      macd: calculateMACD(closesUpToI),
      ma20: calculateSMA(closesUpToI, strategy.indicators.ma.short),
      ma50: calculateSMA(closesUpToI, strategy.indicators.ma.medium),
      ma200: calculateSMA(closesUpToI, strategy.indicators.ma.long),
      volume: volumesUpToI[volumesUpToI.length - 1],
      avgVolume: calculateSMA(volumesUpToI, 20),
      price: closes[i]
    };

    results.push(indicators);
  }

  return results;
}

/**
 * Generate trading signals based on strategy rules
 */
function generateSignals(indicators, rules) {
  const signals = [];

  for (let i = 0; i < indicators.length; i++) {
    const ind = indicators[i];
    let buyScore = 0;
    let sellScore = 0;

    // Skip if not enough data for indicators
    if (!ind.rsi || !ind.ma20 || !ind.ma50 || !ind.ma200) {
      signals.push('HOLD');
      continue;
    }

    // Evaluate buy rules
    for (const rule of rules.buy) {
      if (rule.type === 'rsi' && rule.condition === 'below') {
        if (ind.rsi < rule.value) buyScore++;
      }
      if (rule.type === 'macd' && rule.condition === 'bullishCross') {
        // Simplified: MACD line positive
        if (ind.macd && ind.macd.macd > 0) buyScore++;
      }
      if (rule.type === 'price' && rule.condition === 'above') {
        if (rule.indicator === 'ma20' && ind.price > ind.ma20) buyScore++;
      }
    }

    // Evaluate sell rules
    for (const rule of rules.sell) {
      if (rule.type === 'rsi' && rule.condition === 'above') {
        if (ind.rsi > rule.value) sellScore++;
      }
      if (rule.type === 'macd' && rule.condition === 'bearishCross') {
        // Simplified: MACD line negative
        if (ind.macd && ind.macd.macd < 0) sellScore++;
      }
    }

    // Determine signal - be more lenient
    if (buyScore >= 1 && sellScore === 0) {
      signals.push('BUY');
    } else if (sellScore >= 1 && buyScore === 0) {
      signals.push('SELL');
    } else {
      signals.push('HOLD');
    }
  }

  return signals;
}

/**
 * Simulate trades based on signals
 */
function simulateTrades(signals, data, config) {
  const trades = [];
  let position = null;
  let capital = config.initialCapital;
  let equity = capital;

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const price = data[i].close;
    const timestamp = data[i].timestamp;

    // Buy signal - enter position
    if (signal === 'BUY' && !position) {
      const investAmount = capital * config.positionSize;
      const commission = investAmount * config.commission;
      const shares = (investAmount - commission) / price;

      position = {
        entryPrice: price,
        entryDate: timestamp,
        shares: shares,
        invested: investAmount
      };
    }
    // Sell signal - exit position
    else if (signal === 'SELL' && position) {
      const saleValue = position.shares * price;
      const commission = saleValue * config.commission;
      const netProceeds = saleValue - commission;
      const profit = netProceeds - position.invested;
      const profitPercent = (profit / position.invested) * 100;

      capital += profit;

      trades.push({
        entryDate: position.entryDate,
        exitDate: timestamp,
        entryPrice: position.entryPrice,
        exitPrice: price,
        shares: position.shares,
        profit: profit,
        profitPercent: profitPercent
      });

      position = null;
    }

    // Update equity (capital + current position value)
    if (position) {
      equity = capital + (position.shares * price);
    } else {
      equity = capital;
    }
  }

  // Close any open position at the end
  if (position) {
    const price = data[data.length - 1].close;
    const timestamp = data[data.length - 1].timestamp;
    const saleValue = position.shares * price;
    const commission = saleValue * config.commission;
    const netProceeds = saleValue - commission;
    const profit = netProceeds - position.invested;
    const profitPercent = (profit / position.invested) * 100;

    trades.push({
      entryDate: position.entryDate,
      exitDate: timestamp,
      entryPrice: position.entryPrice,
      exitPrice: price,
      shares: position.shares,
      profit: profit,
      profitPercent: profitPercent
    });
  }

  return trades;
}

/**
 * Calculate performance metrics
 */
function calculateMetrics(trades, initialCapital, finalEquity, data) {
  if (trades.length === 0) {
    return {
      totalReturn: 0,
      winRate: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      avgProfitPerTrade: 0,
      trades: 0,
      bestTrade: 0,
      worstTrade: 0,
      buyHoldReturn: 0
    };
  }

  // Total return
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

  // Win rate
  const winningTrades = trades.filter(t => t.profit > 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  // Average profit per trade
  const avgProfitPerTrade = trades.reduce((sum, t) => sum + t.profitPercent, 0) / trades.length;

  // Sharpe ratio (simplified)
  const returns = trades.map(t => t.profitPercent);
  const meanReturn = stats.mean(returns);
  const stdReturn = stats.standardDeviation(returns);
  const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) : 0;

  // Max drawdown
  let peak = initialCapital;
  let maxDrawdown = 0;
  let equity = initialCapital;

  for (const trade of trades) {
    equity += trade.profit;
    if (equity > peak) {
      peak = equity;
    }
    const drawdown = ((peak - equity) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Best and worst trades
  const bestTrade = Math.max(...trades.map(t => t.profitPercent));
  const worstTrade = Math.min(...trades.map(t => t.profitPercent));

  // Buy and hold comparison
  const buyHoldReturn = ((data[data.length - 1].close - data[0].close) / data[0].close) * 100;

  return {
    totalReturn: totalReturn,
    winRate: winRate,
    sharpeRatio: sharpeRatio,
    maxDrawdown: maxDrawdown,
    avgProfitPerTrade: avgProfitPerTrade,
    trades: trades.length,
    bestTrade: bestTrade,
    worstTrade: worstTrade,
    buyHoldReturn: buyHoldReturn
  };
}

/**
 * Run backtest on historical data
 */
async function runBacktest(symbol, startDate, endDate, strategy) {
  try {
    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    // Fetch historical data
    const data = await getPriceData(symbol, '1d', daysDiff);

    if (data.length === 0) {
      throw new Error('No data available for backtest');
    }

    // Calculate indicators
    const indicators = calculateIndicators(data, strategy);

    // Generate signals
    const signals = generateSignals(indicators, strategy.rules);

    // Simulate trades
    const config = {
      initialCapital: 10000,
      positionSize: 0.02, // 2% per trade
      commission: 0.001   // 0.1% fee
    };

    const trades = simulateTrades(signals, data, config);

    // Calculate final equity
    let finalEquity = config.initialCapital;
    for (const trade of trades) {
      finalEquity += trade.profit;
    }

    // Calculate metrics
    const metrics = calculateMetrics(trades, config.initialCapital, finalEquity, data);

    return {
      strategy: strategy.name,
      symbol: symbol,
      period: `${startDate} to ${endDate}`,
      totalReturn: metrics.totalReturn.toFixed(2) + '%',
      winRate: metrics.winRate.toFixed(1) + '%',
      sharpeRatio: metrics.sharpeRatio.toFixed(2),
      maxDrawdown: metrics.maxDrawdown.toFixed(2) + '%',
      totalTrades: metrics.trades,
      avgProfitPerTrade: metrics.avgProfitPerTrade.toFixed(2) + '%',
      bestTrade: metrics.bestTrade.toFixed(2) + '%',
      worstTrade: metrics.worstTrade.toFixed(2) + '%',
      buyHoldReturn: metrics.buyHoldReturn.toFixed(2) + '%',
      tradeLog: trades
    };
  } catch (error) {
    throw new Error(`Backtest failed: ${error.message}`);
  }
}

/**
 * Export trade log to CSV
 */
function exportTradeLog(trades, filename) {
  const csv = require('csv-writer').createObjectCsvWriter;
  const csvWriter = csv({
    path: filename,
    header: [
      { id: 'entryDate', title: 'Entry Date' },
      { id: 'exitDate', title: 'Exit Date' },
      { id: 'entryPrice', title: 'Entry Price' },
      { id: 'exitPrice', title: 'Exit Price' },
      { id: 'shares', title: 'Shares' },
      { id: 'profit', title: 'Profit ($)' },
      { id: 'profitPercent', title: 'Profit (%)' }
    ]
  });

  return csvWriter.writeRecords(trades);
}

module.exports = {
  runBacktest,
  calculateIndicators,
  generateSignals,
  simulateTrades,
  calculateMetrics,
  exportTradeLog
};
