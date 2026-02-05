/**
 * Telegram Notification Integration
 * Sends alerts via OpenClaw message command
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Send notification to Telegram
 */
async function sendTelegramNotification(message, chatId = null) {
  try {
    // Use environment variable or default chat ID
    const targetChat = chatId || process.env.TELEGRAM_CHAT_ID || '@me';

    // Escape quotes in message
    const escapedMessage = message.replace(/"/g, '\\"');

    const command = `openclaw message send --channel telegram --to "${targetChat}" --message "${escapedMessage}"`;

    await execPromise(command);
    return true;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error.message);
    return false;
  }
}

/**
 * Notify when trading signal changes
 */
async function notifySignalChange(symbol, oldSignal, newSignal, analysis) {
  const emoji = newSignal === 'BUY' ? '🟢' : newSignal === 'SELL' ? '🔴' : '🟡';

  const message = `${emoji} SIGNAL CHANGE: ${symbol}

Old: ${oldSignal} → New: ${newSignal}
Price: $${analysis.currentPrice.toLocaleString()}
RSI: ${analysis.indicators.rsi}
Confidence: ${analysis.confidence}%

${analysis.reasoning}`;

  return await sendTelegramNotification(message);
}

/**
 * Notify on significant price movement
 */
async function notifyPriceAlert(symbol, change, analysis) {
  const emoji = change > 0 ? '📈' : '📉';
  const direction = change > 0 ? 'UP' : 'DOWN';

  const message = `${emoji} PRICE ALERT: ${symbol}

${direction}: ${Math.abs(change).toFixed(2)}%
Current Price: $${analysis.currentPrice.toLocaleString()}
Signal: ${analysis.signal}

Action: ${
    analysis.signal === 'BUY'
      ? '✅ Consider buying'
      : analysis.signal === 'SELL'
        ? '⚠️ Consider selling'
        : '⏸️ Hold position'
  }`;

  return await sendTelegramNotification(message);
}

/**
 * Notify with backtest summary
 */
async function notifyBacktestResults(symbol, result) {
  const message = `📊 BACKTEST RESULTS: ${symbol}

Strategy: ${result.strategy}
Period: ${result.period}

Returns:
• Total: ${result.totalReturn}
• Buy & Hold: ${result.buyHoldReturn}

Performance:
• Win Rate: ${result.winRate}
• Sharpe Ratio: ${result.sharpeRatio}
• Max Drawdown: ${result.maxDrawdown}

Trades: ${result.totalTrades}
Best Trade: ${result.bestTrade}
Worst Trade: ${result.worstTrade}`;

  return await sendTelegramNotification(message);
}

/**
 * Notify with strategy comparison summary
 */
async function notifyStrategyComparison(symbol, results) {
  let message = `🏆 STRATEGY COMPARISON: ${symbol}\n\n`;

  results.slice(0, 3).forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    message += `${medal} ${result.name}\n`;
    message += `   Return: ${result.totalReturn}\n`;
    message += `   Win Rate: ${result.winRate}\n`;
    message += `   Sharpe: ${result.sharpeRatio.toFixed(2)}\n`;
    message += `   Trades: ${result.trades}\n\n`;
  });

  message += `Full results available in backtest logs.`;

  return await sendTelegramNotification(message);
}

/**
 * Send daily summary
 */
async function notifyDailySummary(symbols, analyses) {
  let message = '📅 DAILY CRYPTO SUMMARY\n\n';

  for (const analysis of analyses) {
    const emoji =
      analysis.signal === 'BUY' ? '🟢' :
      analysis.signal === 'SELL' ? '🔴' : '🟡';

    message += `${emoji} ${analysis.symbol}: $${analysis.currentPrice.toLocaleString()}\n`;
    message += `   Signal: ${analysis.signal} (${analysis.confidence}%)\n`;
    message += `   RSI: ${analysis.indicators.rsi}\n\n`;
  }

  return await sendTelegramNotification(message);
}

/**
 * Test notification
 */
async function sendTestNotification() {
  const message = `🤖 Crypto Trader Bot Online

Monitoring system active.
You will receive alerts for:
• Signal changes (BUY/SELL/HOLD)
• Price movements >5%
• Backtest results

Test notification sent at ${new Date().toLocaleString()}`;

  return await sendTelegramNotification(message);
}

module.exports = {
  sendTelegramNotification,
  notifySignalChange,
  notifyPriceAlert,
  notifyBacktestResults,
  notifyStrategyComparison,
  notifyDailySummary,
  sendTestNotification
};
