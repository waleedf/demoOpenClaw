# Deploy OpenClaw to Railway

This guide walks you through deploying your custom OpenClaw instance (with crypto-trader skill) to Railway with GitHub auto-deploy.

## Prerequisites

1. Railway account (sign up at [railway.app](https://railway.app))
2. Anthropic Claude API key ([get one here](https://console.anthropic.com))
3. This repo pushed to GitHub

## Deployment Steps

### 1. Login to Railway (from terminal)

```bash
railway login
```

This opens your browser for authentication.

### 2. Create a New Railway Project

```bash
railway init
```

Choose "Empty Project" and give it a name (e.g., "openclaw-demo").

### 3. Link to GitHub Repository

In Railway dashboard:
1. Go to your project
2. Click "New" → "GitHub Repo"
3. Connect your `demoOpenClaw` repository
4. Railway will auto-detect the Dockerfile

### 4. Add Environment Variables

In Railway dashboard, go to Variables and add:

```
ANTHROPIC_API_KEY=your_claude_api_key_here
```

Optional variables:
- `OPENAI_API_KEY` - if using OpenAI models
- `TELEGRAM_BOT_TOKEN` - for Telegram integration
- `DISCORD_BOT_TOKEN` - for Discord integration

### 5. Add Persistent Volume

1. In Railway dashboard, go to your service
2. Click "Settings" → "Volumes"
3. Add volume:
   - Mount Path: `/data`
   - Size: 1GB (or more)

### 6. Deploy!

Railway will automatically build and deploy. First deployment takes ~5-10 minutes.

## Auto-Deploy Workflow

Once set up, your workflow is:

1. **Edit code on phone** using Claude Code app
2. **Commit & push** to GitHub
3. **Railway auto-detects** the push
4. **Automatic rebuild & deploy** happens
5. **Your bot is updated** with new code!

## Access Your Deployment

After deployment:
- Gateway URL: Check Railway dashboard for your deployment URL
- Port: Railway assigns a public URL that routes to your internal port 18789

## Configure OpenClaw

First time setup:
```bash
railway run openclaw setup
```

Or access the gateway directly via the Railway URL and configure through the web interface (if available).

## Use Your Crypto Trader Skill

Your crypto-trader skill is already installed at `/data/workspace/skills/crypto-trader`.

Test it:
```bash
railway run node /data/workspace/skills/crypto-trader/index.js analyze-chart BTC
```

## Monitoring

View logs in real-time:
```bash
railway logs
```

## Troubleshooting

### Deployment fails
- Check Railway logs for errors
- Ensure Dockerfile builds successfully locally: `docker build -t openclaw-test .`

### Can't connect to gateway
- Check if the health check is passing in Railway dashboard
- Verify environment variables are set correctly
- Ensure volume is mounted at `/data`

### Skill not working
- SSH into Railway container: `railway shell`
- Check if skill files exist: `ls /data/workspace/skills/crypto-trader`
- Test skill directly: `node /data/workspace/skills/crypto-trader/index.js analyze-chart BTC`

## Cost Estimate

With Railway Hobby plan:
- Base: $5/month subscription (includes $5 usage credit)
- Usage: ~$5-10/month for 24/7 OpenClaw instance
- **Total: ~$10-15/month**

## Next Steps

1. Set up Telegram or Discord bot for mobile access
2. Add more custom skills
3. Configure additional AI providers
4. Set up notifications for trading signals

---

**Pro Tip**: Commit and push changes frequently from your phone. Railway deploys are fast (~2-3 minutes after the initial build).
