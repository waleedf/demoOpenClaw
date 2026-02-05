# Telegram Bot Quick Start

Quick reference for setting up Telegram with OpenClaw for username wally331.

## Step 1: Create Bot (On Phone)

1. Open Telegram
2. Search: `@BotFather`
3. Send: `/newbot`
4. Name: `MoltBot` (or your choice)
5. Username: `wally331_bot` (must end in 'bot')
6. **SAVE THE TOKEN** - looks like: `1234567890:ABCdef...`

## Step 2: Configure OpenClaw (On Mac)

### Local Setup

```bash
# Login with your token
openclaw channels login telegram

# Start your bot on phone (send /start to @wally331_bot)

# Check status (get your chat ID)
openclaw channels status

# Test it
openclaw message send --channel telegram --to @me --message "Hello!"
```

### Railway Setup

```bash
# Add to Railway dashboard Variables:
TELEGRAM_BOT_TOKEN=your_token_from_step_1

# Then in Railway shell:
railway shell
openclaw channels login telegram
openclaw channels status
```

## Step 3: Use from Phone

1. Open Telegram
2. Search: `@wally331_bot` (your bot)
3. Send: `/start`
4. Chat naturally with MoltBot!

## For Crypto Notifications

```bash
# Local:
cd ~/.openclaw/workspace/skills/crypto-trader
echo "TELEGRAM_CHAT_ID=@wally331" > .env

# Railway:
# Add variable in dashboard: TELEGRAM_CHAT_ID=@wally331
```

## Troubleshooting

```bash
# Check status
openclaw channels status

# View logs
openclaw logs

# Test message
openclaw message send --channel telegram --to @me --message "test"

# Re-login if needed
openclaw channels login telegram
```

## Important Files

- Full guide: [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)
- Environment variables: `.env.example`
- Crypto trader: `skills/crypto-trader/SETUP_CHECKLIST.md`

## Your Configuration

- Bot username: `@wally331_bot` (or your chosen name)
- Your username: `@wally331`
- Bot name: `MoltBot` (or your chosen name)

---

For complete instructions, see [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)
