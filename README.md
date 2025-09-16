# Jacob Uploads Pre-Bonding Chart Generator

Advanced stochastic crypto chart generation focused on pre-bonding price discovery with organic market phases.

## 🎯 Features

- **Organic Price Discovery**: True stochastic process without artificial directional biases
- **Market Phase Simulation**: Realistic accumulation, consolidation, pullback, recovery, breakout, and final push phases
- **Bonding Curve Mechanics**: Pre-bonding chart generation with $100k bonding ceiling
- **Zone-Aware Mean Reversion**: Natural breakout detection that stops artificial pullback
- **High-Resolution Export**: JSON data export and PNG image generation
- **Real-time Visualization**: Interactive charts using Lightweight Charts library

## 🔬 Mathematical Foundation

### Core Algorithm

- **Geometric Brownian Motion (GBM)** with stochastic volatility
- **Momentum persistence** for trend continuation
- **Cyclical market behavior** for bull/bear cycles
- **Market phase transitions** affecting volatility patterns
- **Zone-aware mean reversion** for natural price discovery

### Key Components

```
dS = μS dt + σS dW  (GBM foundation)
+ Momentum persistence (recent trends continue)
+ Cyclical forces (market waves)
+ Phase-based volatility modulation
+ Adaptive mean reversion (zone-aware)
```

## 🚀 Usage

### Local Development

```bash
# Install dependencies
npm install

# Start local server
npm run dev
# or
python3 -m http.server 8000
```

### Chart Generation

1. Open `http://localhost:8000`
2. Select chart type (Pre-bonding recommended)
3. Choose volatility level
4. Click "Generate Chart"
5. Export as JSON data or PNG image

## 📊 Chart Generation

**Pre-Bonding Charts**: Advanced stochastic price formation with organic market phases leading to the $100k bonding curve. Features:

- 6 distinct market phases (accumulation → consolidation → pullback → recovery → breakout → final push)
- Zone-aware mean reversion ($40k target with $60k breakout threshold)
- True stochastic process without artificial directional biases
- Momentum persistence and cyclical market behavior

## 🧮 Stochastic Process Details

### Market Phases (6 distinct phases)

- **Early Accumulation**: Low volatility, gradual buildup
- **Consolidation**: Very low volatility, sideways movement
- **Pullback**: High volatility, downward pressure
- **Recovery**: Normal volatility, moderate gains
- **Breakout**: High volatility, strong momentum
- **Final Push**: Controlled volatility, approach to targets

### Volatility Levels

- **Low**: 8% per candle
- **Medium**: 15% per candle
- **High**: 25% per candle
- **Extreme**: 35% per candle

### Mean Reversion

- **Zone Target**: 40% of bonding curve ($40k)
- **Breakout Threshold**: 50% above zone (breaks free at $60k)
- **Strength**: 0.8% pull toward zone when contained

## 🎨 Export Capabilities

- **JSON Export**: Complete chart data with metadata
- **PNG Export**: High-resolution chart images (2x scale)
- **Automatic naming**: Chart ID-based filenames

## 🔧 Technical Stack

- **Frontend**: Vanilla JavaScript + HTML5
- **Chart Library**: Lightweight Charts
- **Image Export**: html2canvas
- **Statistical Analysis**: simple-statistics
- **Random Generation**: seedrandom (deterministic)
- **Styling**: Custom dark theme

## 📈 Mathematical Accuracy

This generator produces statistically realistic crypto price movements by combining:

- Proper stochastic calculus (GBM)
- Market microstructure (volatility clustering)
- Behavioral finance (momentum, mean reversion)
- Market phases (technical analysis patterns)

## 🎯 Research Applications

- **Algorithmic Trading**: Test strategies against organic price data
- **Risk Management**: Study extreme market conditions
- **Market Simulation**: Understand crypto market dynamics
- **Educational**: Visualize stochastic processes and market phases

## 📄 License

MIT License - Free for research and educational use.

---

_Generated with advanced stochastic modeling and financial mathematics_
