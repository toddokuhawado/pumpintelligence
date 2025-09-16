# Trading Simulation Chart Generator - Complete Implementation Instructions

## Project Overview
Build a front-end application that generates synthetic trading charts with realistic OHLC (Open, High, Low, Close) data to test AI vision model capabilities. The system simulates cryptocurrency/token trading with distinct pre-bonding and post-bonding phases.

## Core Specifications

### Market Phases
- **Pre-Bonding Phase**: 0 to 100,000 market cap (high volatility)
- **Post-Bonding Phase**: 100,000 to 1,000,000-2,000,000 market cap (varied scenarios)
- **Timeframe**: 1-minute candles
- **Data Format**: Valid OHLC with correlated volume

## Implementation Architecture

### 1. Data Generation Engine

```javascript
class TradingChartGenerator {
  constructor(config) {
    this.config = {
      preBondingCandles: random(100, 500),
      postBondingCandles: random(500, 2000),
      bondingThreshold: 100000,
      maxMarketCap: random(1000000, 2000000),
      basePrice: 0.00001,
      volatilityMultiplier: 1.0,
      scenario: null // Will be randomly selected
    }
  }
}
```

### 2. Pre-Bonding Phase Generation Rules

#### Characteristics
- **Volatility**: 20-50% price swings per candle cluster
- **Trend**: Generally upward toward 100k market cap
- **Patterns to Include**:
  - Accumulation zones (sideways movement with occasional spikes)
  - Failed breakouts (sharp rise followed by rejection)
  - Bart patterns (vertical move up, sideways, vertical down)
  - Whipsaw movements (rapid direction changes)
  - Stop hunts (quick wicks below support)

#### Generation Algorithm
```javascript
generatePreBondingCandle(previousCandle, currentMarketCap) {
  const targetProgress = currentMarketCap / 100000;
  const baseVolatility = 0.02 + (0.03 * Math.random());
  const trendBias = 0.0002 * (1 - targetProgress); // Stronger upward bias when far from target
  
  // Add volatility clusters (periods of high activity)
  const inVolatilityCluster = Math.random() < 0.3;
  const volatility = inVolatilityCluster ? baseVolatility * 2.5 : baseVolatility;
  
  // Calculate price movement
  const priceChange = (Math.random() - 0.5 + trendBias) * volatility;
  const open = previousCandle.close;
  const close = open * (1 + priceChange);
  
  // Generate wicks (high/low)
  const wickMultiplier = inVolatilityCluster ? 1.5 : 1.2;
  const high = Math.max(open, close) * (1 + Math.random() * volatility * wickMultiplier);
  const low = Math.min(open, close) * (1 - Math.random() * volatility * wickMultiplier);
  
  // Volume correlates with price movement and volatility
  const baseVolume = 10000 + Math.random() * 50000;
  const volume = baseVolume * (1 + Math.abs(priceChange) * 10) * (inVolatilityCluster ? 3 : 1);
  
  return { open, high, low, close, volume };
}
```

### 3. Post-Bonding Phase Scenarios

#### Scenario Distribution
- **Instant Rug**: 20% probability
- **Pump and Dump**: 25% probability
- **Organic Growth**: 25% probability
- **Slow Bleed**: 15% probability
- **Consolidation Breakout**: 15% probability

#### Scenario Implementations

##### A. Instant Rug Pattern
```javascript
generateInstantRug(startCandle, duration) {
  const candles = [];
  const rugPoint = random(5, 20); // Rug happens within 5-20 candles
  
  for (let i = 0; i < duration; i++) {
    if (i < rugPoint) {
      // Slight upward movement before rug
      candles.push(generateMildUptrend(previousCandle));
    } else if (i === rugPoint) {
      // The rug candle - 80-95% drop
      const dropPercent = 0.8 + Math.random() * 0.15;
      candles.push(generateMassiveDrop(previousCandle, dropPercent));
    } else {
      // Dead chart - minimal movement, very low volume
      candles.push(generateDeadChart(previousCandle));
    }
  }
  return candles;
}
```

##### B. Pump and Dump Pattern
```javascript
generatePumpAndDump(startCandle, duration) {
  const phases = {
    accumulation: duration * 0.2,
    pump: duration * 0.3,
    distribution: duration * 0.2,
    dump: duration * 0.3
  };
  
  // Accumulation: Slow, steady buying
  // Pump: Parabolic rise (200-1000% gain)
  // Distribution: High volume sideways, lower highs
  // Dump: Cascading selloff back to near starting price
}
```

##### C. Organic Growth Pattern
```javascript
generateOrganicGrowth(startCandle, duration) {
  // Steady uptrend with healthy corrections
  // 20-30% retracements
  // Higher lows and higher highs
  // Volume increases on upward moves
  // Fibonacci retracement levels respected
}
```

##### D. Slow Bleed Pattern
```javascript
generateSlowBleed(startCandle, duration) {
  // Gradual decline over time
  // Failed attempts to break resistance
  // Decreasing volume over time
  // Lower highs and lower lows
  // 60-80% total decline
}
```

##### E. Consolidation Breakout Pattern
```javascript
generateConsolidationBreakout(startCandle, duration) {
  const consolidationEnd = duration * 0.7;
  const breakoutDirection = Math.random() > 0.5 ? 'up' : 'down';
  
  // Tightening range (triangle pattern)
  // Decreasing volume during consolidation
  // Explosive breakout with volume spike
  // 50-200% move on breakout
}
```

### 4. OHLC Data Validation

```javascript
function validateCandle(candle, previousCandle) {
  const rules = [
    // High must be >= both Open and Close
    candle.high >= Math.max(candle.open, candle.close),
    
    // Low must be <= both Open and Close
    candle.low <= Math.min(candle.open, candle.close),
    
    // High must be >= Low
    candle.high >= candle.low,
    
    // Open should be near previous Close (max 10% gap normally)
    Math.abs(candle.open - previousCandle.close) / previousCandle.close < 0.1,
    
    // Volume must be positive
    candle.volume > 0,
    
    // Prices must be positive
    candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0
  ];
  
  return rules.every(rule => rule === true);
}
```

### 5. Chart Variety Generation Parameters

```javascript
const varietyParameters = {
  // Pre-bonding variety
  preBonding: {
    volatilityLevel: ['low', 'medium', 'high', 'extreme'],
    trendStrength: [0.1, 0.3, 0.5, 0.7, 0.9],
    accumationPeriods: [1, 2, 3, 4],
    fakeoutCount: [0, 1, 2, 3, 5],
    supportLevels: generateRandomLevels(2, 5),
    resistanceLevels: generateRandomLevels(2, 5)
  },
  
  // Post-bonding variety
  postBonding: {
    initialPumpStrength: [1.5, 2, 3, 5, 10], // multiplier
    consolidationPeriods: [0, 1, 2, 3],
    retracementDepth: [0.236, 0.382, 0.5, 0.618, 0.786], // Fibonacci
    volumeProfile: ['increasing', 'decreasing', 'stable', 'sporadic'],
    wickPattern: ['normal', 'long_upper', 'long_lower', 'both_long']
  }
};
```

### 6. Output Data Structure

```javascript
{
  "chartId": "chart_[timestamp]_[random]",
  "chartType": "full|pre_only|post_only",
  "scenario": "instant_rug|pump_dump|organic|slow_bleed|consolidation",
  "metadata": {
    "totalCandles": 1440,
    "preBondingCandles": 234,
    "postBondingCandles": 1206,
    "bondingCandleIndex": 234,
    "startMarketCap": 1000,
    "bondingMarketCap": 100000,
    "peakMarketCap": 1850000,
    "finalMarketCap": 45000,
    "volatilityScore": 0.75,
    "trendDirection": "bearish",
    "patternComplexity": "medium"
  },
  "candles": [
    {
      "index": 0,
      "timestamp": 1698307200000,
      "open": 0.00001234,
      "high": 0.00001345,
      "low": 0.00001223,
      "close": 0.00001340,
      "volume": 125000,
      "marketCap": 1000,
      "phase": "pre_bonding"
    },
    // ... more candles
  ],
  "annotations": {
    "keyLevels": [
      {"type": "support", "price": 0.00001200, "strength": 0.8},
      {"type": "resistance", "price": 0.00001500, "strength": 0.9}
    ],
    "patterns": [
      {"type": "double_top", "startIndex": 145, "endIndex": 189},
      {"type": "breakout", "index": 234, "direction": "up"}
    ],
    "events": [
      {"type": "bonding_complete", "index": 234},
      {"type": "rug_pull", "index": 256}
    ]
  }
}
```

### 7. Test Suite Generation

```javascript
class ChartTestSuite {
  generateTestBatch(count = 100) {
    const charts = [];
    const distribution = {
      instant_rug: Math.floor(count * 0.20),
      pump_dump: Math.floor(count * 0.25),
      organic: Math.floor(count * 0.25),
      slow_bleed: Math.floor(count * 0.15),
      consolidation: Math.floor(count * 0.15)
    };
    
    for (let scenario in distribution) {
      for (let i = 0; i < distribution[scenario]; i++) {
        charts.push(this.generateChart(scenario));
      }
    }
    
    return this.shuffleArray(charts);
  }
  
  generateTestQuestions(chart) {
    return [
      {
        question: "Identify the bonding point in this chart",
        answer: chart.metadata.bondingCandleIndex,
        difficulty: "easy"
      },
      {
        question: "What is the primary pattern after bonding?",
        answer: chart.scenario,
        difficulty: "medium"
      },
      {
        question: "Predict the likely next 10-candle movement",
        answer: this.generatePrediction(chart),
        difficulty: "hard"
      },
      {
        question: "Identify all major support and resistance levels",
        answer: chart.annotations.keyLevels,
        difficulty: "medium"
      },
      {
        question: "Calculate the maximum drawdown percentage",
        answer: this.calculateMaxDrawdown(chart),
        difficulty: "easy"
      },
      {
        question: "Is this chart showing signs of manipulation?",
        answer: this.detectManipulation(chart),
        difficulty: "hard"
      }
    ];
  }
}
```

### 8. Rendering Configuration

```javascript
const chartRenderConfig = {
  dimensions: {
    width: 1920,
    height: 1080,
    candleWidth: 5,
    candleSpacing: 2
  },
  colors: {
    bullishCandle: '#00ff00',
    bearishCandle: '#ff0000',
    volume: '#4a4a4a',
    background: '#0a0a0a',
    grid: '#1a1a1a',
    bondingLine: '#ffff00'
  },
  indicators: {
    showVolume: true,
    showMA: [20, 50, 200],
    showBondingMarker: true,
    showGrid: true
  },
  style: 'tradingview|binance|coinbase|custom'
};
```

### 9. Implementation Checklist

- [ ] Set up project structure with modular components
- [ ] Implement base OHLC generator with validation
- [ ] Create pre-bonding phase generator with all patterns
- [ ] Implement all 5 post-bonding scenarios
- [ ] Add volume correlation logic
- [ ] Create validation suite for OHLC consistency
- [ ] Build variety parameter randomization
- [ ] Implement chart metadata generation
- [ ] Create annotation system for patterns/levels
- [ ] Build test question generator
- [ ] Set up batch generation system
- [ ] Create chart rendering engine
- [ ] Add export functionality (JSON, CSV, Image)
- [ ] Implement quality assurance checks
- [ ] Create documentation for AI model testing

### 10. Quality Assurance Metrics

```javascript
const qualityMetrics = {
  realism: {
    priceMovementRealistic: checkPriceMovements(),
    volumeCorrelation: checkVolumeCorrelation(),
    patternValidity: checkPatternValidity(),
    marketCapProgression: checkMarketCapProgression()
  },
  variety: {
    scenarioDistribution: checkScenarioBalance(),
    volatilityRange: checkVolatilityDistribution(),
    patternDiversity: checkPatternDiversity(),
    durationVariance: checkDurationVariance()
  },
  technical: {
    ohlcValid: validateAllCandles(),
    noDataGaps: checkContinuity(),
    timestampConsistency: checkTimestamps(),
    mathematicalAccuracy: checkCalculations()
  }
};
```

## Usage Example

```javascript
// Initialize generator
const generator = new TradingChartGenerator({
  outputFormat: 'json',
  renderCharts: true,
  batchSize: 100
});

// Generate single chart
const chart = generator.generateChart('random');

// Generate test batch
const testBatch = generator.generateTestBatch(100);

// Export for AI testing
generator.exportBatch(testBatch, './test_charts/batch_001/');

// Generate with specific parameters
const customChart = generator.generateChart('pump_dump', {
  preBondingVolatility: 'high',
  pumpMultiplier: 10,
  dumpSeverity: 0.9
});
```

## Notes for AI Model Testing

1. **Vision Model Inputs**: Export charts as PNG images (1920x1080) with consistent styling
2. **Ground Truth**: Include JSON metadata for each chart for accuracy scoring
3. **Difficulty Progression**: Start with clear patterns, progressively add noise and ambiguity
4. **Edge Cases**: Include charts that break typical patterns to test model robustness
5. **Temporal Consistency**: Ensure AI can identify time-based progression in patterns

## Final Considerations

- **Realism**: Balance between realistic market behavior and clear patterns for testing
- **Reproducibility**: Use seeded random for consistent test generation
- **Performance**: Optimize for generating thousands of charts efficiently
- **Extensibility**: Design system to easily add new scenarios and patterns
- **Documentation**: Maintain clear documentation of all pattern types and parameters