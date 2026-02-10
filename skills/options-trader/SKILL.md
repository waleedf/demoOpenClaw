---
name: options-trader
description: Scan for implied vs realized volatility mispricings in crypto options and paper trade them using Deribit free API.
metadata: { "openclaw": { "version": "1.0.0" } }
---

# Options Vol Trading Skill

Scan for implied vs realized volatility mispricings and paper trade them.

## Strategy
- **Sell vol** when IV/RV > 1.3 (options overpriced)
- **Buy vol** when IV/RV < 0.7 (options underpriced)
- Delta-neutral strategies (straddles, strangles, iron condors)

## Files
- `vol_scanner.js` — Main scanner
- `paper_trades.md` — Trade log
- `positions.json` — Open positions
- `PLAN.md` — Full build plan

## Usage
```bash
# Run scanner
node skills/options-trader/vol_scanner.js

# Check positions
cat skills/options-trader/positions.json
```

## Status
Under construction — see PLAN.md for progress
