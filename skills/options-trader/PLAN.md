# Options Vol Trading System — Build Plan

## Goal
Build an autonomous options scanner that identifies IV/RV mispricings and paper trades them. Prove edge over 1-2 weeks before considering real money.

---

## Phase 1: Data Infrastructure (Day 1)
- [x] Set up options data fetching (Deribit API)
- [x] Build realized vol calculator (30-day hourly candles)
- [x] Build implied vol extractor (ATM options)

## Phase 2: Signal Generation (Day 1-2)
- [x] IV/RV ratio > 1.3 = SELL signal
- [x] IV/RV ratio < 0.7 = BUY signal
- [x] Filter by DTE (7-45 days)

## Phase 3: Paper Trading System (Day 2)
- [x] paper_trades.md created
- [ ] positions.json tracker
- [ ] Exit rules implementation

## Phase 4: Automation (Day 2-3)
- [ ] Heartbeat/cron integration
- [ ] Telegram alerts on signals
- [ ] Daily P&L summary

## Phase 5: Backtest & Validation (Day 3-5)
- [ ] Historical backtest
- [ ] Compare paper vs backtest

## Phase 6: Evaluation (Day 7-14)
- [ ] 1-2 weeks paper trading
- [ ] Performance report
- [ ] Go/no-go decision

---

## Progress Notes
- **2026-02-09**: Scanner built using Deribit free API for BTC/ETH options
- First scan: BTC IV 53.3% vs RV 57.8%, ETH IV 76.9% vs RV 80.0%
- No signals yet (IV/RV ratios within normal range)
- Pivoted from stock options to crypto options (better free data access)
