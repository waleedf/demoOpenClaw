# Crypto Trading Bot

This repository includes a custom OpenClaw skill for cryptocurrency trading using technical analysis.

## What's Included

### Crypto Trader Skill
Location: `~/.openclaw/workspace/skills/crypto-trader/`

**Features:**
- Real-time cryptocurrency market data
- Technical indicators (RSI, MACD, Moving Averages, Bollinger Bands)
- Automated chart analysis with buy/sell signals
- Market overview for multiple coins
- Volume and trend analysis

**How to Use:**

```bash
# Full analysis of Bitcoin
node ~/.openclaw/workspace/skills/crypto-trader/index.js analyze-chart BTC

# Market overview
node ~/.openclaw/workspace/skills/crypto-trader/index.js get-market-overview BTC,ETH,SOL

# Calculate RSI
node ~/.openclaw/workspace/skills/crypto-trader/index.js calculate-rsi BTC
```

## Example Output

When you run `analyze-chart BTC`, you get:

```json
{
  "symbol": "BTC",
  "currentPrice": 73271.26,
  "indicators": {
    "rsi": "18.13",        // Oversold = potential buy opportunity
    "ma20": "86394.81",    // 20-day moving average
    "ma50": "88448.95",    // 50-day moving average
    "ma200": "103300.10",  // 200-day moving average
    "bollingerBands": {
      "upper": "99135.55",
      "middle": "86394.81",
      "lower": "73654.06"
    }
  },
  "signal": "BUY",           // Trading signal
  "confidence": 70,          // Confidence level (0-100)
  "reasoning": "RSI oversold (potential buy). Price below major MAs (bearish trend). Volume confirming uptrend",
  "support": "73271.26",
  "resistance": "95516.08"
}
```

## Trading Strategy

The bot analyzes:
1. **RSI** - Identifies overbought (>70) and oversold (<30) conditions
2. **Moving Averages** - Determines trend direction
3. **MACD** - Momentum indicator
4. **Bollinger Bands** - Volatility and reversal points
5. **Volume** - Confirms trend strength
6. **Support/Resistance** - Key price levels

## Safety First

- Currently configured for **analysis only** (no live trading)
- Test with paper trading before using real money
- Never invest more than you can afford to lose
- Technical analysis is probabilistic, not certain

## Next Steps

1. Use the tool to analyze various cryptocurrencies
2. Track the accuracy of signals over time
3. Refine strategies based on results
4. When confident, consider small test trades
5. Implement risk management (stop losses, position sizing)

## Data Source

Uses CoinGecko API (free, no API key required).

## Remember

**This is not financial advice.** Markets are unpredictable. Use at your own risk.
