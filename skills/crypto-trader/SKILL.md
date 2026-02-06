---
name: crypto-trader
description: Analyze cryptocurrency markets using technical indicators and fundamental data. Make informed trading decisions based on real data, not vibes.
metadata: { "openclaw": { "version": "1.0.0" } }
---

# Crypto Trader - Technical Analysis & Trading

## What This Skill Does

This skill gives you access to:
- Real-time cryptocurrency price data (OHLCV - Open, High, Low, Close, Volume)
- Technical indicators (RSI, MACD, Moving Averages, Bollinger Bands)
- Market fundamentals (market cap, volume, volatility)
- Backtesting framework for strategy testing
- Paper trading mode for risk-free testing

## Commands & Tools

### Data Fetching

- `get-price-data <symbol> <timeframe> <limit>` - Fetch OHLCV data
  - Example: `get-price-data BTC 1h 100` (last 100 hours of BTC data)
  - Timeframes: 1m, 5m, 15m, 1h, 4h, 1d, 1w

- `get-market-overview <symbols>` - Get current market snapshot
  - Example: `get-market-overview BTC,ETH,SOL`
  - Returns: price, 24h change, volume, market cap

### Technical Indicators

- `calculate-rsi <symbol> <period>` - Relative Strength Index
  - Default period: 14
  - Oversold: < 30, Overbought: > 70

- `calculate-macd <symbol>` - MACD indicator
  - Returns: MACD line, signal line, histogram
  - Bullish crossover: MACD crosses above signal

- `calculate-moving-averages <symbol> <periods>` - SMAs/EMAs
  - Example: `calculate-moving-averages BTC 20,50,200`
  - Returns: specified moving averages

- `calculate-bollinger-bands <symbol> <period> <stddev>` - Bollinger Bands
  - Default: 20 period, 2 std deviations
  - Shows volatility and potential reversal points

### Analysis & Strategy

- `analyze-chart <symbol>` - Comprehensive technical analysis
  - Runs all indicators
  - Identifies patterns
  - Provides trading signal (buy/sell/hold)
  - Includes confidence level

- `backtest <symbol> <strategy>` - Test strategy on 6 months of historical data
  - Example: `backtest BTC current`
  - Strategies: current, aggressive, conservative, momentum, mean-reversion
  - Returns: Total return, win rate, Sharpe ratio, max drawdown, trade count

- `compare-strategies <symbol>` - Compare all strategies on same data
  - Example: `compare-strategies ETH`
  - Ranks strategies by Sharpe ratio (risk-adjusted return)
  - Shows performance metrics for each strategy

- `monitor <symbols>` - Monitor cryptos and send alerts
  - Example: `monitor BTC,ETH,SOL`
  - Detects signal changes (BUY→SELL→HOLD)
  - Alerts on price moves >5%
  - Sends Telegram notifications
  - Stores state in .state/crypto-signals.json

## Trading Philosophy

You are a technical analyst, not a gambler. Follow these principles:

1. **Data-Driven Decisions**: Every trade must be justified by technical indicators
2. **Risk Management**: Never risk more than 2% of portfolio on a single trade
3. **Confirmation**: Wait for multiple indicators to align before trading
4. **Stop Losses**: Always set stop losses to protect capital
5. **Position Sizing**: Use appropriate position sizes based on risk tolerance

## Analysis Framework

When analyzing a crypto, check:

1. **Trend** (Moving Averages)
   - Price above 200-day MA = bullish trend
   - Golden cross (50 MA > 200 MA) = strong bullish
   - Death cross (50 MA < 200 MA) = strong bearish

2. **Momentum** (RSI, MACD)
   - RSI < 30 = oversold (potential buy)
   - RSI > 70 = overbought (potential sell)
   - MACD bullish crossover = momentum shifting up

3. **Volatility** (Bollinger Bands)
   - Price touching lower band = potential bounce
   - Price touching upper band = potential pullback
   - Bands squeezing = volatility expansion coming

4. **Volume**
   - Rising price + rising volume = healthy trend
   - Rising price + falling volume = weak trend

5. **Support/Resistance**
   - Check recent highs/lows
   - Look for price rejection zones

## Example Analysis Workflow

```
User: "Should I buy Bitcoin?"

You:
1. Fetch BTC price data (last 200 periods)
2. Calculate RSI, MACD, MAs (20, 50, 200)
3. Calculate Bollinger Bands
4. Check volume trend
5. Analyze all data

Response format:
"Bitcoin Analysis (2026-02-04)

Current Price: $62,450
24h Change: +2.3%

Technical Indicators:
- RSI (14): 45 (neutral, slightly bearish)
- MACD: Bullish crossover forming
- MA 20: $61,200 (price above - short-term bullish)
- MA 50: $58,900 (price above - medium-term bullish)
- MA 200: $55,000 (price above - long-term bullish)
- Bollinger Bands: Price in middle channel (neutral)
- Volume: Increasing on recent uptrend (bullish confirmation)

Support: $60,000
Resistance: $65,000

Signal: CAUTIOUS BUY
Confidence: 65%

Reasoning: Price is above all major MAs indicating bullish trend. MACD
about to cross bullish. RSI neutral allows room to move up. Volume
confirming. However, approaching resistance at $65k.

Recommended Entry: $61,500-62,000
Stop Loss: $59,500 (below recent support)
Take Profit: $67,000 (next resistance level)
Risk/Reward: 1:3 (Good)
Position Size: 2% of portfolio max"
```

## Safety & Risk Management

- Start with paper trading ONLY
- Never trade with money you can't afford to lose
- Always use stop losses
- Max 2-3% risk per trade
- Diversify across multiple assets
- Don't FOMO into pumps
- Don't panic sell on dumps
- Follow the plan, not emotions

## Data Sources

This skill uses:
- CoinGecko API (free tier, 30 calls/min)
- Historical price data from crypto exchanges
- Technical analysis calculations done locally

## Installation Requirements

```bash
# Install Node.js packages for this skill
cd ~/.openclaw/workspace/skills/crypto-trader
npm install axios ccxt simple-statistics csv-writer
```

## Configuration

Create `.env` file in skill directory:
```
COINGECKO_API_KEY=optional
TELEGRAM_CHAT_ID=@your_username_or_chat_id
```

To set up Telegram notifications:
1. Run `openclaw channels login telegram`
2. Follow prompts to create/configure bot
3. Get your chat ID (send `/start` to bot)
4. Add chat ID to .env file above

## Automated Monitoring

The skill is configured to run every 30 minutes via OpenClaw heartbeat:
- Checks BTC, ETH, SOL for signal changes
- Sends Telegram alerts on signal changes or >5% price moves
- Stores signal history in ~/.openclaw/workspace/.state/crypto-signals.json
- Active hours: 8:00 AM to 11:00 PM

To modify monitoring:
- Edit HEARTBEAT.md to change symbols or frequency
- Edit openclaw.json to adjust heartbeat interval or active hours

## Next Steps

1. Complete skill installation (npm packages)
2. Test with paper trading
3. Run backtests on historical data
4. When confident, consider small real money trades
5. Track all trades and analyze performance

## Remember

- Markets are unpredictable
- No strategy wins 100% of the time
- Protect your capital first, profits second
- Learn from every trade (win or loss)
- Technical analysis is probability, not certainty

---

**Status:** Active
**Mode:** Paper Trading (change to Live Trading when ready)
**Portfolio:** $10,000 (virtual)
