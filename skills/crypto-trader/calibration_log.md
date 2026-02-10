# Calibration Log

Last updated: 2026-02-10 20:54 UTC

## Our Trades: Predicted vs Actual

### Model-Based Crypto Trades Only (excluding inherited, lottery, and mistake trades)

| # | Date | Market | My Prob | Mkt Price | Edge | Expiry | Outcome | Notes |
|---|------|--------|---------|-----------|------|--------|---------|-------|
| 1 | Feb 08 | KXBTC B70750 | 63% | 33¢ | +30% | ~1h | ✅ YES | BTC $70,800, in-bucket |
| 4 | Feb 09 | KXETH B2090 | 61.5% | 51¢ | +10.5% | ~32min | ❌ NO | ETH dropped $25 out of bucket |
| 6 | Feb 09 | KXBTC B70250 | 35% | 22¢ | +15% | ~4.4h | ✅ YES | BTC stayed in bucket |
| 7 | Feb 09 | KXETH B2120 | ~35%* | 23¢ | +12%* | ~3h* | ✅ YES | Accidental 72-lot, lucky |
| 8 | Feb 10 | KXBTC B69625 | 31.8% | 26¢ | +5.8% | ~42min | ❌ NO | BTC rallied $200 out |

*Trade 7 prob estimated; entry was during debugging, not clean model read.

### Calibration Summary (n=5 model trades)

**Win rate: 3/5 = 60%**
**Average predicted probability: ~45%**
**Expected wins at avg prob: ~2.3/5**
**Actual wins: 3/5**

→ **Slightly lucky so far, but roughly calibrated given tiny sample.**

### By Predicted Probability Bucket

| Predicted Range | Count | Wins | Actual Win% | Expected Win% | Gap |
|-----------------|-------|------|-------------|---------------|-----|
| 30-40% | 3 (#6, #7, #8) | 2 | 67% | ~34% | +33% (lucky) |
| 60-65% | 2 (#1, #4) | 1 | 50% | ~62% | -12% (unlucky) |

→ Low-prob trades winning more than expected, high-prob trades winning less. Classic small-sample noise, but also possible model overconfidence at high probabilities.

### By Edge Size

| Edge | Count | Wins | Win% |
|------|-------|------|------|
| >15% | 2 (#1: 30%, #6: 15%) | 2 | 100% |
| 5-15% | 3 (#4: 10.5%, #7: ~12%, #8: 5.8%) | 1 | 33% |

→ **Big edges (>15%) are 2/2. Small edges (5-15%) are 1/3.** This is the key finding.

### By Time to Expiry

| Expiry | Count | Wins | Win% |
|--------|-------|------|------|
| <1h | 2 (#4: 32min, #8: 42min) | 0 | 0% |
| 1-5h | 3 (#1: 1h, #6: 4.4h, #7: ~3h) | 3 | 100% |

→ **Sub-hour trades: 0/2. 1-5 hour trades: 3/3.** Very short expiries seem to hurt us.

---

## Kalshi Settlement Data Analysis (Feb 10, 2026)

Pulled from API — recent KXBTC and KXETH settled markets:

### BTC Settlement Pattern (3 hourly windows)
- 18:00 UTC → settled in B69875 ($69,750-$69,999.99) — our Trade #8 bucket (B69625) was one bucket below, missed
- 19:00 UTC → settled in B68875 ($68,750-$68,999.99) — dropped ~$1000 in an hour
- 20:00 UTC → settled in B69125 ($69,000-$69,249.99) — bounced back

### ETH Settlement Pattern (3 hourly windows)  
- 18:00 UTC → B2030 ($2,020-$2,039.99)
- 19:00 UTC → B2010 ($2,000-$2,019.99)
- 20:00 UTC → B2010 ($2,000-$2,019.99) — stayed in same bucket

**Key observation:** BTC moved across 5 buckets ($1,250 range) in 3 hours. ETH only moved across 2 buckets ($40 range). BTC is significantly more volatile in absolute bucket terms — $250 buckets are narrower relative to BTC's volatility than ETH's $20 buckets.

### Can We Assess "Current Bucket" Base Rate from API?

Unfortunately, settled markets don't retain pre-settlement orderbook data (yes_bid=0 for all settled markets). We can't reconstruct what the market price was when someone entered. However, from the volume distribution:

- **Winning BTC bucket:** 38,328 volume vs neighboring buckets 17,731 and 34,040 — the current/expected bucket attracts the most volume
- **Winning ETH bucket:** 23,028 volume vs neighboring 26,955 and 8,472

The high volume in adjacent buckets suggests lots of people are trading the "near current" buckets — competition is real.

---

## Brier Score Calculation

| Trade | Predicted | Outcome | Brier |
|-------|-----------|---------|-------|
| #1 | 0.63 | 1 | (1-0.63)² = 0.137 |
| #4 | 0.615 | 0 | (0-0.615)² = 0.378 |
| #6 | 0.35 | 1 | (1-0.35)² = 0.423 |
| #7 | 0.35 | 1 | (1-0.35)² = 0.423 |
| #8 | 0.318 | 0 | (0-0.318)² = 0.101 |

**Average Brier Score: 0.292**

For reference: 0.25 = coin flip, 0.0 = perfect. We're at 0.292 — **slightly worse than random.**

This is misleading though — Brier Score measures probability accuracy, but our profit comes from the *edge* (buying below fair value). Even with imperfect probabilities, if we buy 35% events at 22¢ and they win 35% of the time, we profit.

**Expected P/L per trade if calibrated:**
- Trade #1: EV = 0.63 × $1.00 - 0.33 = +$0.30 → actual +$0.67 ✅
- Trade #4: EV = 0.615 × $1.00 - 0.51 = +$0.105 → actual -$0.53 ❌
- Trade #6: EV = 0.35 × $1.00 - 0.22 = +$0.13 → actual +$0.78 ✅  
- Trade #8: EV = 0.318 × $1.00 - 0.26 = +$0.058 → actual -$0.274 ❌

Total EV if calibrated: +$0.593/trade × 5 = ~$2.97
Actual model-trade P/L: +$1.30 - $0.53 + $32.78 + $55.39 - $2.74 = **+$86.20** (inflated by Trade #7 sizing accident)

---

## Key Findings

### 1. Model is Overconfident on Short Expiries
Both sub-hour trades (61.5% and 31.8% predicted) lost. The lognormal model may underestimate tail moves in very short windows — crypto often has sudden $200-300 moves in minutes from liquidation cascades. The lognormal assumption of smooth returns breaks down.

### 2. Small Edges (5-15%) Don't Survive Friction
1/3 win rate on 5-15% edge trades. After fees (~3-5% of notional), a 5.8% edge becomes ~1-2% true edge — almost nothing. Need larger edges to overcome fees + model uncertainty.

### 3. Vol Parameters Updated but May Still Be Wrong
Scanner now uses 58% BTC, 80% ETH (up from original 50%/55%). But realized vol is highly regime-dependent — a quiet hour has 30% annualized vol, a chaotic hour has 100%+. Single-point vol estimate is structurally flawed.

### 4. Bucket Width Matters
BTC $250 buckets = 0.36% of price. ETH $20 buckets = 0.96% of price. BTC buckets are ~2.7x tighter relative to price, so BTC bucket trades need proportionally higher edge.

---

## Concrete Model Improvements

### Immediate (High Impact)
1. **Minimum edge threshold: raise to 10% for <1h expiry, 8% for 1-4h** — sub-5.8% edge trades are unprofitable after fees
2. **Add fee-adjusted edge** — subtract ~4¢ per contract from expected value before deciding
3. **Short-expiry penalty** — for <1h, multiply vol by 1.3x to account for microstructure jumps (liquidation cascades, sudden wicks)

### Medium Term
4. **Regime-adaptive vol** — instead of fixed 58%/80%, compute rolling 1h realized vol from Binance kline data. Use max(historical_vol, model_vol) for conservatism
5. **Position in bucket matters** — if price is within 30% of bucket edge, reduce prob by 10-15%. Our winners were mid-bucket; our losers were closer to edges
6. **Time-of-day adjustment** — vol spikes around US market open (14:30 UTC) and Asian open (00:00 UTC). Reduce edge requirement during quiet hours, increase during volatile sessions

### Structural
7. **Track model vs market delta over time** — if market consistently prices higher than us for current buckets, the market may know something (e.g., accounting for order flow, news risk)
8. **Kelly sizing** — with 5 trades, Kelly suggests 10-15% of bankroll per trade max for our edge sizes. Trade #7's accidental 72 contracts ($16.61) was 10% of bankroll — lucky it won
9. **Move to YES-on-above/below for directional views** — bucket trades require price to *stay*, which is a specific bet. Above/below markets may have better liquidity and wider mispricings

---

## Next Steps
- [ ] Implement rolling vol from Binance klines in scanner
- [ ] Add fee adjustment to edge calculation  
- [ ] Add minimum edge by expiry tier
- [ ] Track position-in-bucket (% distance from edges) for each trade
- [ ] Get to 20+ model trades before drawing strong conclusions
