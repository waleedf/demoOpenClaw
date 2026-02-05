# Setup Checklist

Run through this checklist to ensure everything is configured correctly.

## ✅ Already Complete

- [x] Dependencies installed (simple-statistics, csv-writer)
- [x] Heartbeat configured in openclaw.json (30 min interval)
- [x] HEARTBEAT.md updated with crypto monitoring
- [x] Execute permissions on index.js
- [x] State directory will be auto-created

## 🔧 Required Setup

### 1. Telegram Bot Configuration

**Required for notifications to work**

```bash
# Step 1: Login to Telegram
openclaw channels login telegram

# Step 2: Get your chat ID
# Send /start to your bot, then check status
openclaw channels status

# Step 3: Create .env file with your chat ID
cd ~/.openclaw/workspace/skills/crypto-trader
echo "TELEGRAM_CHAT_ID=@your_username_or_chat_id" > .env

# Or set as environment variable
export TELEGRAM_CHAT_ID=@your_username
```

**Test it:**
```bash
openclaw message send --channel telegram --to @me --message "Test from crypto-trader"
```

### 2. Wait for CoinGecko Rate Limit Reset

We hit the rate limit during testing. Wait 60 seconds, then test:

```bash
cd ~/.openclaw/workspace/skills/crypto-trader

# Test 1: Analyze chart (should work)
node index.js analyze-chart BTC

# Test 2: Monitor (creates state file)
node index.js monitor BTC

# Test 3: Backtest (requires most API calls)
node index.js backtest BTC current
```

### 3. Verify Heartbeat is Running

```bash
# Check OpenClaw agent status
openclaw agent status

# OR manually trigger heartbeat check
openclaw agent --message "Check HEARTBEAT.md" --local
```

## 🎛️ Optional Configuration

### Customize Monitored Symbols

Edit `HEARTBEAT.md` to change which cryptos are monitored:
```bash
# Default: BTC,ETH,SOL
# Change to: BTC,ETH,SOL,ADA,DOT
```

### Adjust Heartbeat Timing

Edit `~/.openclaw/openclaw.json`:
```json
"heartbeat": {
  "every": "30m",        // Change to: "15m", "1h", etc.
  "activeHours": {
    "start": "08:00",    // Adjust to your timezone
    "end": "23:00"       // When to stop monitoring
  }
}
```

### Adjust Alert Thresholds

Edit `index.js` line ~150 to change price alert threshold:
```javascript
// Current: >5% price move triggers alert
if (Math.abs(priceChange) > 5) {
  // Change to 3% for more frequent alerts
  // Or 10% for less frequent alerts
```

### Get CoinGecko API Key (Optional)

Free tier limits:
- 50 calls/minute
- Daily OHLC data only

Pro tier benefits:
- Higher rate limits
- More data granularity
- Better historical data

If you upgrade, add to .env:
```bash
echo "COINGECKO_API_KEY=your_api_key_here" >> .env
```

Then update `indicators.js` to use API key in headers.

## 🧪 Testing Checklist

Run these tests to verify everything works:

```bash
cd ~/.openclaw/workspace/skills/crypto-trader

# 1. Basic analysis (uses 1 API call)
node index.js analyze-chart BTC

# 2. Monitor command (uses 1 API call per symbol)
node index.js monitor BTC

# 3. Run monitor again to test change detection
node index.js monitor BTC
# Should show "status": "OK" if no changes

# 4. Check state file was created
cat ~/.openclaw/workspace/.state/crypto-signals.json

# 5. Backtest (uses ~180 API calls for 6 months)
# Wait 60s after previous commands
sleep 60
node index.js backtest BTC current

# 6. Compare strategies (uses ~900 API calls)
# This will take a few minutes due to rate limiting
node index.js compare-strategies BTC
```

## 📊 Expected Outputs

### Successful Monitor Output:
```json
{
  "status": "OK",
  "alerts": [],
  "timestamp": "2026-02-05T00:02:08.992Z"
}
```

### Successful Backtest Output:
```json
{
  "strategy": "Current (RSI14 + MACD + 3 MAs)",
  "symbol": "BTC",
  "period": "2025-08-04 to 2026-02-05",
  "totalReturn": "34.5%",
  "winRate": "62.3%",
  "sharpeRatio": "1.87",
  "totalTrades": 18
}
```

## ⚠️ Common Issues

### Issue: "Failed to fetch price data: 429"
**Solution**: CoinGecko rate limit. Wait 60 seconds and try again.

### Issue: "Failed to send Telegram notification"
**Solution**:
1. Run `openclaw channels login telegram`
2. Verify .env file has TELEGRAM_CHAT_ID
3. Test with: `openclaw message send --channel telegram --to @me --message "test"`

### Issue: Backtest shows 0 trades
**Solution**:
- Strategy rules might be too strict for current market
- Try different strategy: `node index.js backtest BTC aggressive`
- Or different symbol: `node index.js backtest ETH current`

### Issue: Heartbeat not running
**Solution**:
1. Check openclaw.json has heartbeat config
2. Restart OpenClaw agent
3. Verify HEARTBEAT.md is not empty

## ✅ Final Verification

After setup, you should have:

- [ ] Telegram bot responding to test messages
- [ ] `analyze-chart` command working
- [ ] `monitor` command creating state file
- [ ] `backtest` command returning results
- [ ] State file at `~/.openclaw/workspace/.state/crypto-signals.json`
- [ ] No errors in any command outputs

## 🚀 Ready to Go!

Once all checkboxes are complete:
1. Heartbeat will run automatically every 30 minutes
2. You'll get Telegram alerts on signal changes or >5% moves
3. State is tracked between runs
4. All commands are available via CLI

## 📞 Support

If issues persist:
1. Check logs: `openclaw logs`
2. Verify OpenClaw version: `openclaw --version`
3. Test components individually
4. Check CoinGecko status: https://status.coingecko.com

---

**Last Updated**: 2026-02-05
