# Artificial Pump Intelligence (API) Project Plan

## 1. Vision & North Star
- Build an AI-assisted trading copilot that ingests real-time PumpFun token launches, performs visual + quantitative technical analysis, and surfaces actions through an interactive terminal UI.
- Long-term differentiator: vision-driven TA paired with reinforcement learning to let the `API` memecoin treasury market-make itself and eventually offer the intelligence layer to partner coins.

## 2. Problem Framing & Usefulness Check
- **Existing automated TA**: Platforms like TradingView (Auto TA), TrendSpider, Autochartist, Capitalise.ai, Kryll, and Numerai already generate TA overlays or no-code strategies. They rarely operate on PumpFun microcaps, have limited meme coin focus, and seldom combine raw chart vision with narrative terminal outputs.
- **Differentiators to validate**:
  - Real-time coverage of PumpFun launches (15–30k liquidity range focus).
  - Vision-first explanations ("what the AI sees"), not just indicators.
  - Closed-loop treasury bot that self-trades a single coin for credibility and storytelling.
- **Use cases**: narrative content to attract investors, gated analytics/API for other coins, internal signals for your treasury bot.
- **Feasibility check**: Ambitious but plausible if phased; requires staged delivery (visual sandbox → data streaming → automated TA overlays → decision engine → execution).

## 3. Guiding Questions Before Heavy Build
1. Regulatory: are you comfortable with the compliance obligations of automated trading + fee sharing?
2. Data access: PumpPortal real-time API reliability, latency, rate limits, and completeness.
3. Infrastructure: on-chain interaction stack (Solana RPC, key management, dummy accounts for paper trading).
4. Vision models: availability of Claude or GPT-4o vision access with reasonable latency and cost.
5. Success criteria: what metrics define "semi successful"? Win rate, PnL, drawdown, explanation quality?

## 4. High-Level Architecture (Phase-aware)
- **Data Ingestion Layer**: WebSocket/stream client listening to PumpPortal, filtering tokens by liquidity and metadata, persisting candles (TimescaleDB/ClickHouse/S3).
- **Chart Service**: Headless chart renderer (TradingView Lightweight Charts or custom Canvas) producing snapshots for AI consumption and terminal UI.
- **Analysis Engines**:
  - Baseline indicators (moving averages, volume profiles, trendlines) + heuristics for automated TA.
  - Vision layer (Claude/GPT-4o vision) that receives chart images with metadata and produces narrative + lines.
  - Optional RL layer that learns execution policy from simulated + paper trades.
- **Decision/Execution Layer**: Rule-based guardrails, risk budgets, and connectors to PumpFun/Solana programs for paper trading; later escalate to live treasury management.
- **Presentation Layer**: Terminal-like front end (web-based) showing streaming market tape, charts, AI commentary, and action logs.
- **Ops & Telemetry**: Logging, backtesting environment, configuration store for strategy parameters.

## 5. Proposed Roadmap & Milestones
1. **M0 – Sandbox Visualizer** (current work)
   - Solidify synthetic chart generator for demo content.
   - Stand up terminal UI skeleton (React/Vite or Next.js) with mocked AI commentary.
2. **M1 – Live Data Tap**
   - Build PumpPortal stream client + persistence.
   - Render live candles via TradingView Lightweight Charts or custom D3/Canvas chart.
   - Display token watchlist (15–30k liquidity) with health metrics.
3. **M2 – Automated TA Baseline**
   - Implement deterministic TA overlays (trendlines, RSI, VWAP, volume spikes).
   - Generate textual summaries (template + heuristics); integrate LLM for polishing.
   - Evaluate overlay accuracy on historical data.
4. **M3 – Vision-Assisted Insights**
   - Pipe chart snapshots into Claude/GPT for visual descriptions.
   - Blend indicator outputs + vision narrative to produce explainable decisions.
   - Build evaluation harness comparing AI commentary vs indicator ground truth.
5. **M4 – Decision Engine & Paper Trading**
   - Define playbooks (momentum scalp, mean reversion) with explicit risk controls.
   - Execute in paper trading mode; track PnL, holding periods, volatility exposure.
   - Introduce RL or bandit methods guided by feedback loops.
6. **M5 – Treasury Autonomy & External API**
   - Wire live execution with small capital, guardrails, and human override.
   - Launch API endpoints / dashboard for partner coins.
   - Marketing site detailing win cases; integrate fees/revenue share.

## 6. Workstreams & Ownership
- **Frontend/UX**: Terminal UI, chart rendering, user flows, explanation UX.
- **Backend/Data**: Stream ingestion, storage, backtesting services.
- **AI/ML**: Vision prompt design, indicator fusion, RL experimentation.
- **Trading Ops**: Strategy design, treasury management, compliance.
- **DevOps/SRE**: Deployment, monitoring, secrets management.

## 7. Immediate Action Items (Next 2 Weeks)
1. Confirm PumpPortal API contract (fields, ping/pong, rate limits); stub client with logging.
2. Decide on charting path: embed TradingView Lightweight Charts vs custom stack; assess licensing.
3. Design terminal UI wireframe (data panes, chart area, AI commentary, trade blotter).
4. Outline indicator set + signal thresholds for initial heuristics.
5. Define paper trading sandbox: wallet abstraction, order execution simulator, PnL tracking.
6. Document success metrics (latency, signal hit-rate, PnL targets, explanation quality rubric).

## 8. Risks & Mitigations
- **Regulatory/Legal**: Engage counsel early; clarify disclosures and jurisdiction.
- **Data Quality**: Build redundancy (backup data providers, caching) and alerting for stream drops.
- **Model Reliability**: Gate live trades with human-in-the-loop; fallback to deterministic rules if LLM fails.
- **Security**: Secure key storage, access control, supply chain audits for dependencies.
- **Latency & Cost**: Monitor API/LLM usage costs; consider local inference for scaling.
- **User Trust**: Provide transparent logs, confidence scores, and fail-safe mechanisms.

## 9. Evaluation & KPI Framework
- **Trading**: Sharpe ratio, max drawdown, PnL per strategy, hit rate on identified setups.
- **AI Insights**: % of signals with accurate support/resistance, qualitative feedback from traders.
- **Operational**: Data downtime, latency, error rates, cost per 1k analyses.
- **Growth**: Number of partner coins onboarded, API usage, community engagement.

## 10. Next Deliverables
- Detailed technical spec for M1 (ingestion + chart UI).
- Prompting playbook for vision-powered TA commentary.
- Compliance checklist for running an automated treasury bot on PumpFun/Solana.

---
_Last updated: 2025-10-02 00:31 UTC_
