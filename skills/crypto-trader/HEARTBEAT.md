# Crypto Market Monitor

Run the crypto-trader monitor to check for price changes and trading signals.

```bash
node ~/.openclaw/workspace/skills/crypto-trader/index.js monitor BTC,ETH,SOL
```

If any alerts are returned (signal changes or >5% price moves), send them to the user via Telegram.
