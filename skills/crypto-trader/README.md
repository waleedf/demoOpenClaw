# Crypto Trading Bot - Backtesting + Telegram Monitoring

A fully automated backtesting and monitoring system for cryptocurrency trading.

## Features

- **Backtesting**: Test strategies on 6 months of historical data
- **Strategy Comparison**: Compare 5 different trading strategies
- **Live Monitoring**: Check prices every 30 minutes via OpenClaw heartbeat
- **Telegram Alerts**: Get notified on signal changes or >5% price moves
- **Performance Metrics**: Track win rate, Sharpe ratio, max drawdown

## Commands

### Backtest a Strategy
```bash
node index.js backtest BTC current
```

Available strategies: `current`, `aggressive`, `conservative`, `momentum`, `mean-reversion`

### Compare All Strategies
```bash
node index.js compare-strategies ETH
```

### Monitor Cryptos
```bash
node index.js monitor BTC,ETH,SOL
```

### Analyze Chart
```bash
node index.js analyze-chart BTC
```

### Get Market Overview
```bash
node index.js get-market-overview BTC,ETH,SOL
```

## Automated Monitoring

The system runs every 30 minutes via OpenClaw heartbeat:
- Checks BTC, ETH, SOL for signal changes
- Sends Telegram alerts on signal changes or >5% moves
- Stores state in `~/.openclaw/workspace/.state/crypto-signals.json`
- Active hours: 8:00 AM - 11:00 PM

## Telegram Setup

1. Run `openclaw channels login telegram`
2. Get your chat ID
3. Create `.env` file:
```bash
echo "TELEGRAM_CHAT_ID=@your_username" > .env
```

## Files

- **backtest.js** - Backtesting engine
- **strategies.js** - 5 trading strategies
- **notify.js** - Telegram notifications
- **indicators.js** - Technical indicators
- **index.js** - CLI interface

## Architecture

```
OpenClaw Heartbeat (30 min)
    ↓
Crypto-Trader Skill
    ↓
Telegram Notifications
```

## Testing

### Test Monitor
```bash
node index.js monitor BTC
```

### Test Backtest
```bash
node index.js backtest BTC current
```

**Note**: CoinGecko rate limit is 50 calls/min. Wait 60s if you get 429 errors.

## Performance Metrics

- **Total Return**: Strategy return vs initial capital
- **Win Rate**: Percentage of profitable trades
- **Sharpe Ratio**: Risk-adjusted return (>1.0 good, >2.0 excellent)
- **Max Drawdown**: Largest peak-to-trough decline

## Next Steps

1. Configure Telegram: `openclaw channels login telegram`
2. Test monitoring: `node index.js monitor BTC,ETH,SOL`
3. Run backtest: `node index.js backtest BTC current`
4. Compare strategies: `node index.js compare-strategies BTC`
5. Let heartbeat run automatically

## Status

✅ Implementation complete
✅ Dependencies installed
✅ Heartbeat configured
✅ Documentation updated

**Version**: 1.0.0
**Last Updated**: 2026-02-05
