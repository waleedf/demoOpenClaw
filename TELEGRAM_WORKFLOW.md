# Telegram + OpenClaw Workflow

Visual guide showing how Telegram connects to OpenClaw (MoltBot).

## Architecture Overview

```
┌─────────────────┐
│  Your Phone     │
│   (Telegram)    │
└────────┬────────┘
         │
         │ Messages
         │
         ▼
┌─────────────────┐
│  Telegram Bot   │
│  @wally331_bot  │
└────────┬────────┘
         │
         │ Bot API
         │ (via token)
         │
         ▼
┌─────────────────┐
│   OpenClaw      │
│  (MoltBot AI)   │
└────────┬────────┘
         │
         │ API Calls
         │
         ▼
┌─────────────────┐
│  Claude API     │
│  (Anthropic)    │
└─────────────────┘
```

## Message Flow

### 1. You Send a Message

```
[Your Phone] → "Analyze BTC chart"
     ↓
[Telegram] → Routes to @wally331_bot
     ↓
[Telegram Bot] → Forwards to OpenClaw
     ↓
[OpenClaw] → Processes with Claude AI
     ↓
[OpenClaw] → May call crypto-trader skill
     ↓
[OpenClaw] → Generates response
     ↓
[Telegram Bot] → Sends response back
     ↓
[Your Phone] → Receives analysis
```

### 2. Automated Notifications

```
[OpenClaw Heartbeat] → Every 30 minutes
     ↓
[crypto-trader skill] → Checks BTC/ETH/SOL prices
     ↓
[Detects signal change or >5% price move]
     ↓
[OpenClaw] → Sends notification via Telegram
     ↓
[Telegram Bot] → Delivers to your phone
     ↓
[Your Phone] → You get alert!
```

## Setup Workflow

### Phase 1: Create Bot (5 minutes)

```
1. Open Telegram on phone
   ↓
2. Find @BotFather
   ↓
3. Send /newbot
   ↓
4. Choose name: "MoltBot"
   ↓
5. Choose username: "wally331_bot"
   ↓
6. SAVE THE TOKEN
   ✓ Bot created!
```

### Phase 2: Configure OpenClaw (5 minutes)

#### Local Setup

```
1. openclaw channels login telegram
   ↓
2. Paste bot token
   ↓
3. Send /start to bot on phone
   ↓
4. openclaw channels status
   ↓
5. Note your chat ID (@wally331)
   ✓ Connected!
```

#### Railway Setup

```
1. Add TELEGRAM_BOT_TOKEN to Railway
   ↓
2. Railway auto-deploys
   ↓
3. railway shell
   ↓
4. openclaw channels login telegram
   ↓
5. Send /start to bot on phone
   ↓
6. openclaw channels status
   ✓ Connected!
```

### Phase 3: Test & Use (2 minutes)

```
1. Open Telegram
   ↓
2. Find @wally331_bot
   ↓
3. Send /start
   ↓
4. Send "Hello!"
   ↓
5. Get response from MoltBot
   ✓ Working!
```

## Connection States

### Not Connected

```
┌─────────────┐
│  Your Phone │  ✗ Can't send messages
└─────────────┘

┌─────────────┐
│  OpenClaw   │  ✗ No bot token set
└─────────────┘
```

### Connected (No Chat)

```
┌─────────────┐
│  Your Phone │  ⚠ Haven't sent /start yet
└─────────────┘
      │
      ▼
┌─────────────┐
│  Telegram   │  ✓ Bot exists
│     Bot     │  ✗ No active chat
└─────────────┘
      │
      ▼
┌─────────────┐
│  OpenClaw   │  ✓ Token configured
└─────────────┘
```

### Fully Connected

```
┌─────────────┐
│  Your Phone │  ✓ Can send/receive
└─────────────┘
      ↕
┌─────────────┐
│  Telegram   │  ✓ Bot active
│     Bot     │  ✓ Chat established
└─────────────┘
      ↕
┌─────────────┐
│  OpenClaw   │  ✓ Token set
│             │  ✓ Chat ID known
└─────────────┘
```

## Data Flow Examples

### Example 1: Simple Question

```
You: "What's the weather?"
  → Telegram → Bot → OpenClaw
                        ↓
                     Claude API processes
                        ↓
MoltBot: "I don't have weather data access..."
  ← Telegram ← Bot ← OpenClaw
```

### Example 2: Crypto Command

```
You: "Analyze BTC"
  → Telegram → Bot → OpenClaw
                        ↓
                   Calls crypto-trader skill
                        ↓
                   Fetches CoinGecko data
                        ↓
                   Calculates indicators
                        ↓
                   Claude API formats response
                        ↓
MoltBot: "BTC Analysis: RSI: 58, MACD: Bullish..."
  ← Telegram ← Bot ← OpenClaw
```

### Example 3: Heartbeat Alert

```
[OpenClaw Heartbeat Timer] → 30 min elapsed
                                   ↓
                         Executes crypto-trader
                                   ↓
                         Checks BTC/ETH/SOL
                                   ↓
                    [BTC up 6% - triggers alert!]
                                   ↓
                         Sends via Telegram
                                   ↓
You receive: "🚨 BTC Alert: +6.2% in 30min..."
```

## Token & ID Reference

```
┌──────────────────────────────────────┐
│  TELEGRAM_BOT_TOKEN                  │
│  What: API token from BotFather      │
│  Format: 1234567890:ABCdef...        │
│  Where: .env or Railway variables    │
│  Used by: OpenClaw to control bot    │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  TELEGRAM_CHAT_ID                    │
│  What: Your user ID                  │
│  Format: @wally331 or numeric ID     │
│  Where: .env or Railway variables    │
│  Used by: crypto-trader for alerts   │
└──────────────────────────────────────┘
```

## Security Flow

```
Bot Token:
  Created by → BotFather (Telegram)
            → Given to you (one time)
            → Stored in .env (encrypted)
            → Used by OpenClaw (to authenticate)
            → Never shared publicly
            → Can be revoked/regenerated

Chat ID:
  Generated by → Telegram (when you /start)
             → Discovered by OpenClaw
             → Used to route messages
             → Identifies your chat
             → Not secret (but not advertised)
```

## Troubleshooting Flow

```
Problem: Bot not responding

Check 1: Is token set?
  NO  → Run: openclaw channels login telegram
  YES → Check 2

Check 2: Did you /start the bot?
  NO  → Open Telegram, send /start to @wally331_bot
  YES → Check 3

Check 3: Is OpenClaw running?
  NO  → Start: openclaw agent start
  YES → Check 4

Check 4: Check logs
  → openclaw logs
  → Look for errors
  → Test: openclaw message send --channel telegram --to @me --message "test"
```

## Deployment Scenarios

### Scenario A: Local Development

```
[Your Mac] ← You work here
    ↓
[OpenClaw running locally]
    ↓
[Telegram Bot] ← Via bot token
    ↓
[Your Phone] ← You message here

Pros: Fast iteration, full control
Cons: Mac must be on, not mobile
```

### Scenario B: Railway Deployment

```
[Railway Cloud] ← OpenClaw runs here
    ↓
[Telegram Bot] ← Via bot token
    ↓
[Your Phone] ← You message here

Pros: 24/7 access, works anywhere
Cons: Needs Railway account, slight delay
```

### Scenario C: Hybrid (Recommended)

```
[Your Mac] ← Development & testing
    ↓
[Git Push]
    ↓
[Railway] ← Production, 24/7
    ↓
[Telegram Bot]
    ↓
[Your Phone] ← Always works

Workflow:
1. Edit code on Mac
2. Test locally
3. Git push to deploy
4. Railway auto-updates
5. Bot uses new code
```

## Next Steps

After setup:

```
1. Test basic chat
   └→ Send "Hello" to bot

2. Test crypto commands
   └→ Send "Analyze BTC"

3. Set up notifications
   └→ Add TELEGRAM_CHAT_ID

4. Wait for heartbeat alert
   └→ Runs every 30 min

5. Deploy to Railway (optional)
   └→ See RAILWAY_DEPLOY.md
```

## Quick Commands Reference

```bash
# Setup
openclaw channels login telegram     # First time setup
openclaw channels status              # Check connection
openclaw channels logout telegram    # Disconnect

# Testing
openclaw message send --channel telegram --to @me --message "test"

# Debugging
openclaw logs                         # View logs
openclaw agent status                 # Check if running
openclaw config show                  # View config

# For Railway
railway variables                     # View env vars
railway shell                         # SSH into container
railway logs                          # View logs
```

---

For detailed instructions, see:
- [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) - Full setup guide
- [TELEGRAM_QUICKSTART.md](TELEGRAM_QUICKSTART.md) - Quick reference
- [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md) - Cloud deployment
