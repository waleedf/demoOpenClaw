# Telegram Bot Setup Checklist

Follow this checklist to set up your Telegram bot for OpenClaw (MoltBot) with username wally331.

## Pre-Setup

- [ ] Telegram app installed on your phone
- [ ] OpenClaw installed locally or Railway account ready
- [ ] Claude API key configured in OpenClaw

## Part 1: Create Telegram Bot (5 minutes)

### On Your Phone

- [ ] Open Telegram app
- [ ] Search for `@BotFather`
- [ ] Open chat with BotFather
- [ ] Send command: `/newbot`
- [ ] Enter bot name: `MoltBot` (or your choice)
- [ ] Enter bot username: `wally331_bot` (must end in 'bot')
- [ ] Copy the bot token (looks like: `1234567890:ABCdef...`)
- [ ] Save the token somewhere safe (Notes app, password manager, etc.)

**Token saved**: ✓

### Optional: Customize Bot

- [ ] Send `/setdescription` to BotFather
- [ ] Enter: "Your personal OpenClaw AI assistant. Send me messages to interact with MoltBot!"
- [ ] Send `/setabouttext` to BotFather
- [ ] Enter a brief about text
- [ ] Send `/setuserpic` to upload a profile picture (optional)

## Part 2: Configure OpenClaw

Choose your setup path:

### Path A: Local Setup (Mac)

- [ ] Open Terminal on your Mac
- [ ] Run: `openclaw channels login telegram`
- [ ] Paste your bot token when prompted
- [ ] Wait for "Successfully logged in" message

**OpenClaw configured**: ✓

### Path B: Railway Setup

- [ ] Open Railway dashboard in browser
- [ ] Go to your OpenClaw project
- [ ] Click on your service
- [ ] Go to "Variables" tab
- [ ] Click "Add Variable"
- [ ] Key: `TELEGRAM_BOT_TOKEN`
- [ ] Value: paste your bot token
- [ ] Save (Railway will auto-redeploy)
- [ ] Wait 2-3 minutes for deployment
- [ ] Run: `railway shell`
- [ ] In shell, run: `openclaw channels login telegram`

**Railway configured**: ✓

## Part 3: Connect from Phone

- [ ] Open Telegram on your phone
- [ ] Search for your bot: `@wally331_bot` (or your username)
- [ ] Open the bot chat
- [ ] Send: `/start`
- [ ] Send: "Hello!"
- [ ] Verify you get a response from MoltBot

**Bot responding**: ✓

## Part 4: Get Your Chat ID

### Local Setup

- [ ] In Terminal, run: `openclaw channels status`
- [ ] Look for your chat ID (will be like `@wally331` or a numeric ID)
- [ ] Note it down: `________________________`

### Railway Setup

- [ ] In Railway shell: `openclaw channels status`
- [ ] Look for your chat ID
- [ ] Note it down: `________________________`

**Chat ID obtained**: ✓

## Part 5: Test the Connection

### Send Test Message

- [ ] Run: `openclaw message send --channel telegram --to @me --message "Test from OpenClaw"`
- [ ] Check your phone - you should receive the message

**Test message received**: ✓

### Send from Phone

- [ ] On phone, send to your bot: "What's 2 + 2?"
- [ ] Verify bot responds with answer

**Two-way communication working**: ✓

## Part 6: Configure Crypto Notifications (Optional)

Only if you're using the crypto-trader skill:

### Local Setup

- [ ] Run: `cd ~/.openclaw/workspace/skills/crypto-trader`
- [ ] Run: `echo "TELEGRAM_CHAT_ID=@wally331" > .env`
  - Replace `@wally331` with your actual chat ID from Part 4

### Railway Setup

- [ ] Go to Railway dashboard Variables
- [ ] Click "Add Variable"
- [ ] Key: `TELEGRAM_CHAT_ID`
- [ ] Value: `@wally331` (your chat ID from Part 4)
- [ ] Save

**Crypto notifications configured**: ✓

### Test Crypto Notifications

- [ ] Run: `node ~/.openclaw/workspace/skills/crypto-trader/index.js monitor BTC`
  - Or on Railway: `railway run node /data/workspace/skills/crypto-trader/index.js monitor BTC`
- [ ] Check if you receive a Telegram notification

**Crypto alerts working**: ✓

## Part 7: Verify Everything Works

### Basic Commands

- [ ] Send to bot: "What's the weather?" (should get a response)
- [ ] Send to bot: "Tell me a joke" (should get a response)
- [ ] Send to bot: "Help" (should explain capabilities)

### Crypto Commands (if skill installed)

- [ ] Send to bot: "Analyze BTC chart"
- [ ] Send to bot: "What's the BTC price?"
- [ ] Verify you get analysis/price data

### Automated Alerts (if configured)

- [ ] Wait for heartbeat (runs every 30 minutes)
- [ ] Check if you receive automatic crypto alerts
- [ ] Or manually trigger: `openclaw agent --message "Check HEARTBEAT.md" --local`

## Troubleshooting Checklist

If something isn't working:

### Bot Not Responding

- [ ] Verify bot token is correct: `openclaw channels status`
- [ ] Check OpenClaw is running: `openclaw agent status`
- [ ] Check logs: `openclaw logs`
- [ ] Try re-login: `openclaw channels login telegram`
- [ ] Verify you sent `/start` to the bot

### Token Issues

- [ ] Check token format (should be: `numbers:alphanumeric`)
- [ ] Verify no extra spaces in token
- [ ] Try regenerating token: send `/newtoken` to BotFather

### Messages Not Delivering

- [ ] Verify chat ID is correct
- [ ] Check if you're in the right chat
- [ ] Test with: `openclaw message send --channel telegram --to @me --message "test"`
- [ ] Check Telegram app is up to date

### Railway-Specific Issues

- [ ] Verify environment variables are set correctly
- [ ] Check Railway logs: `railway logs`
- [ ] Verify deployment completed successfully
- [ ] Try redeploying: `railway up`

## Security Checklist

- [ ] Bot token saved securely (not in plain text files)
- [ ] Token not committed to git (check .gitignore includes .env)
- [ ] Only you have access to the bot token
- [ ] Chat ID is correct (messages go only to you)

## Final Verification

Check all core functionality:

- [ ] Can message bot from phone ✓
- [ ] Bot responds to messages ✓
- [ ] Can send messages from OpenClaw to phone ✓
- [ ] Bot token configured securely ✓
- [ ] Chat ID identified ✓
- [ ] Two-way communication working ✓

### Optional Features

- [ ] Crypto notifications configured ✓
- [ ] Heartbeat running automatically ✓
- [ ] Railway deployment (if using cloud) ✓

## Quick Reference

### Your Configuration

- Bot name: `MoltBot` (or: `_____________`)
- Bot username: `@wally331_bot` (or: `_____________`)
- Your chat ID: `@wally331` (or: `_____________`)
- Token location: `.env` or Railway Variables

### Important Files

- Setup guide: [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)
- Quick reference: [TELEGRAM_QUICKSTART.md](TELEGRAM_QUICKSTART.md)
- Workflow diagram: [TELEGRAM_WORKFLOW.md](TELEGRAM_WORKFLOW.md)
- Example config: [.env.example](.env.example)

### Useful Commands

```bash
# Status & Testing
openclaw channels status
openclaw channels login telegram
openclaw message send --channel telegram --to @me --message "test"

# Debugging
openclaw logs
openclaw agent status
openclaw config show

# Railway (if using)
railway variables
railway shell
railway logs
```

## Next Steps

After completing this checklist:

1. **Use your bot daily**
   - Message it from your phone anytime
   - Ask questions, get crypto updates
   - Test different commands

2. **Set up automation** (optional)
   - Configure heartbeat for crypto monitoring
   - Set up price alerts
   - Create custom commands

3. **Deploy to Railway** (optional)
   - Follow [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)
   - Get 24/7 access to your bot
   - Edit code from phone with Claude Code app

4. **Share with others** (optional)
   - Give bot username to trusted users
   - They can send `/start` to begin
   - Configure access control in OpenClaw

## Completion

When all checkboxes are complete:

**Your Telegram bot is fully set up and ready to use!**

Date completed: `_____________`

Notes:
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

**Need help?** See [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) for detailed troubleshooting.

**Last Updated**: 2026-02-04
