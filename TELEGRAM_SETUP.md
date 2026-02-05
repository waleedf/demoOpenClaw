# Telegram Bot Setup for OpenClaw

Complete guide to creating and configuring a Telegram bot for OpenClaw (MoltBot) integration with username wally331.

## Overview

This guide will help you:
1. Create a new Telegram bot using BotFather
2. Get your bot token
3. Configure OpenClaw to use the bot
4. Connect from your phone to interact with MoltBot

## Part 1: Create Your Telegram Bot

### Step 1: Open Telegram and Find BotFather

On your phone:
1. Open Telegram app
2. Search for `@BotFather` in the search bar
3. Start a chat with BotFather (it's the official bot creation bot)

### Step 2: Create a New Bot

1. Send the command: `/newbot`
2. BotFather will ask for a **name** for your bot
   - Example: `MoltBot` or `OpenClaw Assistant`
   - This is the display name users will see
3. BotFather will ask for a **username**
   - Must end in `bot` (e.g., `wally331_bot` or `wally331bot`)
   - Must be unique across all Telegram
   - Suggested: `wally331_bot` or `wally331_openclaw_bot`

### Step 3: Save Your Bot Token

After creating the bot, BotFather will send you a message like:

```
Done! Congratulations on your new bot. You will find it at t.me/wally331_bot
You can now add a description, about section and profile picture for your bot.

Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890

Keep your token secure and store it safely, it can be used by anyone to control your bot.
```

**IMPORTANT**: Copy and save this token somewhere safe. This is your `TELEGRAM_BOT_TOKEN`.

### Step 4: Customize Your Bot (Optional)

You can customize your bot with these BotFather commands:
- `/setdescription` - Set a description shown in chat
- `/setabouttext` - Set an "about" text
- `/setuserpic` - Upload a profile picture
- `/setcommands` - Set custom commands for the bot menu

Example description:
```
Your personal OpenClaw AI assistant. Send me messages to interact with MoltBot!
```

## Part 2: Configure OpenClaw

### Option A: Local OpenClaw Setup

If running OpenClaw locally on your Mac:

#### 1. Login to Telegram via OpenClaw

```bash
openclaw channels login telegram
```

This command will:
- Prompt you for your bot token
- Set up the Telegram integration
- Save the configuration

When prompted, paste your `TELEGRAM_BOT_TOKEN` from Step 3.

#### 2. Get Your Chat ID

After logging in:
1. On your phone, open Telegram
2. Search for your bot (e.g., `@wally331_bot`)
3. Send `/start` to your bot
4. Back on your Mac, check the status:

```bash
openclaw channels status
```

This will show your chat ID. It will look like `@wally331` or a numeric ID.

#### 3. Set Your Chat ID (for crypto-trader skill)

If you're using the crypto-trader skill for notifications:

```bash
cd ~/.openclaw/workspace/skills/crypto-trader
echo "TELEGRAM_CHAT_ID=@wally331" > .env
```

Or set it as an environment variable:

```bash
export TELEGRAM_CHAT_ID=@wally331
```

#### 4. Test the Connection

```bash
openclaw message send --channel telegram --to @me --message "Hello from MoltBot!"
```

You should receive this message on your phone in the chat with your bot.

### Option B: Railway Deployment

If deploying OpenClaw to Railway:

#### 1. Add Environment Variable

In the Railway dashboard:
1. Go to your OpenClaw project
2. Click on your service
3. Go to "Variables" tab
4. Add a new variable:
   - **Key**: `TELEGRAM_BOT_TOKEN`
   - **Value**: Your bot token from Part 1, Step 3

#### 2. Redeploy

Railway will automatically redeploy with the new environment variable.

#### 3. Complete Setup via Railway Shell

```bash
# SSH into Railway container
railway shell

# Login to Telegram (it will use the TELEGRAM_BOT_TOKEN from environment)
openclaw channels login telegram

# Check status
openclaw channels status
```

#### 4. Get Your Chat ID

1. Send `/start` to your bot on your phone
2. In Railway shell, check status to see your chat ID:

```bash
openclaw channels status
```

#### 5. Add Chat ID for Notifications (Optional)

If using crypto-trader skill, add another Railway environment variable:
- **Key**: `TELEGRAM_CHAT_ID`
- **Value**: Your chat ID (e.g., `@wally331`)

## Part 3: Connect from Your Phone

### Starting a Conversation

1. Open Telegram on your phone
2. Search for your bot username (e.g., `@wally331_bot`)
3. Tap on the bot to open the chat
4. Send `/start` to begin

### Using MoltBot

Once connected, you can:
- **Send messages**: Just type normally and send
- **Ask questions**: "What's the weather in San Francisco?"
- **Get crypto updates**: "What's the BTC price?"
- **Run commands**: "Check my crypto portfolio"
- **Interact naturally**: MoltBot uses Claude AI to understand context

### Example Commands

```
/start - Start interacting with MoltBot
/help - Get help and available commands

Or just chat naturally:
"Analyze BTC chart"
"What's the latest news?"
"Run a backtest on ETH"
```

### Receiving Notifications

If you've set up the crypto-trader skill:
- You'll automatically receive alerts for signal changes
- Price movements >5% trigger notifications
- Heartbeat runs every 30 minutes (during active hours)

## Part 4: Advanced Configuration

### Multiple Users

To allow multiple users to interact with your bot:

1. Each user sends `/start` to your bot
2. Get each user's chat ID from `openclaw channels status`
3. Add users to allowlist (if OpenClaw supports it)

### Security Best Practices

1. **Never share your bot token** - Anyone with the token can control your bot
2. **Regenerate token if exposed**: Send `/revoke` to BotFather, then `/newtoken`
3. **Use environment variables** - Never commit tokens to git
4. **Restrict access** - Configure OpenClaw to only respond to your chat ID

### Debugging

If messages aren't working:

```bash
# Check OpenClaw logs
openclaw logs

# Test Telegram connection
openclaw channels status

# Send test message
openclaw message send --channel telegram --to @me --message "Test"

# Check if bot token is set
# Local:
openclaw config show

# Railway:
railway variables
```

### Rate Limits

Telegram has rate limits:
- Max 30 messages per second to different users
- Max 1 message per second to the same user
- If you hit limits, Telegram will return errors

## Part 5: Integration with .env File

Your `.env` file should have these Telegram-related variables:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
TELEGRAM_CHAT_ID=@wally331

# Claude API (required)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Other services
COINGECKO_API_KEY=your_coingecko_api_key_here
```

### For Railway

Add these as environment variables in the Railway dashboard instead of a `.env` file.

## Part 6: Troubleshooting

### "Bot token not found" Error

**Solution**:
```bash
# Re-login to Telegram
openclaw channels login telegram

# Or set environment variable
export TELEGRAM_BOT_TOKEN=your_token_here
```

### Bot Doesn't Respond

**Checklist**:
1. Verify bot token is correct
2. Check if OpenClaw agent is running: `openclaw agent status`
3. Ensure you sent `/start` to the bot
4. Check OpenClaw logs for errors
5. Test with `openclaw message send` command

### Can't Find Your Bot

- Make sure the username ends in `bot`
- Search using `@username` format
- Check BotFather to see your bot list: `/mybots`

### Token Regeneration

If you need a new token:
1. Go to BotFather
2. Send `/mybots`
3. Select your bot
4. Choose "API Token"
5. Select "Revoke current token"
6. Get your new token
7. Update it in OpenClaw configuration

## Part 7: Quick Reference

### Bot Creation
```
Telegram → Search @BotFather → /newbot → Name → Username
```

### Local Setup
```bash
openclaw channels login telegram
openclaw channels status
openclaw message send --channel telegram --to @me --message "test"
```

### Railway Setup
```
Railway Dashboard → Variables → Add TELEGRAM_BOT_TOKEN
railway shell
openclaw channels login telegram
```

### Phone Connection
```
Telegram → Search @your_bot → /start → Chat naturally!
```

## Summary

You now have:
- A Telegram bot created via BotFather
- Bot token configured in OpenClaw
- Ability to message your bot from your phone
- Integration with MoltBot AI assistant
- Optional crypto trading notifications

Your bot username: `wally331_bot` (or whatever you chose)
Your chat username: `@wally331`

Start chatting with your bot on Telegram to interact with OpenClaw/MoltBot from anywhere!

---

**Need Help?**
- Check OpenClaw docs: https://docs.openclaw.ai
- BotFather commands: Send `/help` to @BotFather
- OpenClaw logs: `openclaw logs`
- Test connection: `openclaw channels status`

**Last Updated**: 2026-02-04
