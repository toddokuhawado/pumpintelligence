// Chart Generator with proper financial modeling
class ChartGenerator {
  constructor() {
    // Bonding curve constants
    this.INITIAL_MCAP = 5000; // $5k starting
    this.BONDING_MCAP = 100000; // $100k bonding threshold - CEILING
    this.TOKEN_SUPPLY = 1000000000; // 1B tokens

    // Initialize with proper random seeding
    this.seed = Math.random().toString(36).substr(2, 9);
    this.rng = new Math.seedrandom(this.seed);

    // Statistical helpers from simple-statistics (global)
    this.stats = ss;

    // Market phases for realistic crypto behavior (accessible everywhere)
    this.marketPhases = [
      {
        name: "early_accumulation",
        start: 0.0,
        end: 0.15,
        bias: 0.002, // Minimal directional bias - let randomness dominate
        volMult: 0.6, // Low volatility
      },
      {
        name: "consolidation",
        start: 0.15,
        end: 0.35,
        bias: 0.0, // Neutral - pure random walk
        volMult: 0.4, // Very low volatility - boring consolidation
      },
      {
        name: "pullback",
        start: 0.35,
        end: 0.45,
        bias: -0.003, // Slight downward pressure
        volMult: 1.3, // Moderate volatility
      },
      {
        name: "recovery",
        start: 0.45,
        end: 0.65,
        bias: 0.001, // Minimal upward bias
        volMult: 1.1, // Normal volatility
      },
      {
        name: "breakout",
        start: 0.65,
        end: 0.8,
        bias: 0.003, // Slight upward tendency
        volMult: 1.4, // High volatility
      },
      {
        name: "final_push",
        start: 0.8,
        end: 1.0,
        bias: 0.008, // Moderate push toward target
        volMult: 1.5, // High but controlled volatility
      },
    ];
  }

  // Random utilities using seeded generator
  random(min, max) {
    return this.rng() * (max - min) + min;
  }

  randomInt(min, max) {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  // Box-Muller transform for normal distribution using seeded random
  gaussianRandom() {
    let u = 0,
      v = 0;
    while (u === 0) u = this.rng();
    while (v === 0) v = this.rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  generate(options = {}) {
    const {
      chartType = "full",
      scenario = "random",
      volatility = "medium",
    } = options;

    // Pick random scenario if needed
    const scenarios = [
      "organic",
      "pump_dump",
      "instant_rug",
      "slow_bleed",
      "consolidation",
    ];
    const finalScenario =
      scenario === "random"
        ? scenarios[Math.floor(Math.random() * scenarios.length)]
        : scenario;

    const result = {
      id: `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scenario: finalScenario,
      data: [],
      metadata: {},
    };

    let data = [];

    // Generate pre-bonding if needed
    if (chartType === "full" || chartType === "pre") {
      const preBonding = this.generatePreBonding(volatility);
      data = [...data, ...preBonding];

      // Debug: Check if we reached exactly $100k and show price range
      if (preBonding.length > 0) {
        const lastPrice = preBonding[preBonding.length - 1].close;
        const firstPrice = preBonding[0].close;
        const prices = preBonding.map((c) => c.close);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        console.log(
          `Pre-bonding: ${firstPrice.toFixed(0)} → ${lastPrice.toFixed(
            2
          )} (bonding at: ${this.BONDING_MCAP}, no ceiling)`
        );
        console.log(
          `Price range: ${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)}`
        );
        console.log(`Candles generated: ${preBonding.length}`);

        // Show market phases summary
        const phaseCounts = {};
        let breakoutCount = 0;
        preBonding.forEach((candle, i) => {
          const progress = i / (preBonding.length - 1);
          const phase =
            this.marketPhases.find(
              (p) => progress >= p.start && progress < p.end
            ) || this.marketPhases[this.marketPhases.length - 1];
          phaseCounts[phase.name] = (phaseCounts[phase.name] || 0) + 1;

          // Count natural breakouts above zone targets (40k * 1.5 = 60k threshold)
          if (candle.close > this.BONDING_MCAP * 0.4 * 1.5) breakoutCount++;
        });
        console.log("Market phases:", phaseCounts);
        console.log(
          `Natural breakouts detected: ${breakoutCount}/${preBonding.length} candles`
        );

        // Show some example percentage changes
        const changes = preBonding
          .slice(1)
          .map(
            (c, i) =>
              ((c.close - preBonding[i].close) / preBonding[i].close) * 100
          );
        const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
        const maxChange = Math.max(...changes.map(Math.abs));
        console.log(
          `Avg change: ${avgChange.toFixed(2)}%, Max swing: ${maxChange.toFixed(
            1
          )}%`
        );
      }
    }

    // Generate post-bonding if needed
    if (chartType === "full" || chartType === "post") {
      const startMcap =
        data.length > 0 ? data[data.length - 1].close : this.BONDING_MCAP;

      const postBonding = this.generatePostBonding(
        startMcap,
        finalScenario,
        volatility
      );
      data = [...data, ...postBonding];
    }

    // Convert to lightweight-charts format - DISPLAY MARKET CAP directly
    const now = Math.floor(Date.now() / 1000);
    result.data = data.map((candle, i) => ({
      time: now - (data.length - i) * 60, // 1-minute candles
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    // Calculate metadata
    result.metadata = this.calculateMetadata(data);

    return result;
  }

  generatePreBonding(volatility) {
    const candles = [];
    const numCandles = this.randomInt(150, 400);

    // Volatility settings - HIGHLY volatile for organic crypto charts
    const volMap = {
      low: 0.08,
      medium: 0.15,
      high: 0.25,
      extreme: 0.35,
    };
    const vol = volMap[volatility] || 0.15;

    // Start at exactly 5k
    let currentMcap = this.INITIAL_MCAP;

    // Calculate required growth using compound interest
    const totalGrowth = this.BONDING_MCAP / this.INITIAL_MCAP; // 20x
    const timeSteps = numCandles;
    const requiredDrift = Math.log(totalGrowth) / timeSteps;

    // Initialize volume with realistic starting point
    let volumeAvg = this.stats.mean([50000, 150000]); // Use statistical mean

    // Use market phases defined in constructor
    const phases = this.marketPhases;

    // Initialize momentum tracking for organic trend emergence
    let shortTermMomentum = 0;
    let longTermMemory = 0;

    for (let i = 0; i < numCandles; i++) {
      const progress = i / (numCandles - 1); // 0 to 1

      // Find current market phase
      const currentPhase =
        phases.find(
          (phase) => progress >= phase.start && progress < phase.end
        ) || phases[phases.length - 1];

      // PURE STOCHASTIC PROCESS - No directional bias, trends emerge naturally
      const baseVolatility = vol * currentPhase.volMult;
      const randomShock = this.gaussianRandom() * baseVolatility;

      // Momentum effects - recent price action influences direction (reduced persistence)
      const momentumInfluence = shortTermMomentum * 0.2; // Reduced momentum persistence
      const memoryInfluence = longTermMemory * 0.05; // Reduced long-term memory

      // Cyclical market behavior (bull/bear cycles independent of progress)
      const cyclePosition = Math.sin(i * 0.05) * 0.5; // Natural market cycles
      const cycleInfluence = cyclePosition * baseVolatility * 0.2;

      // LOWER MATHEMATICAL TARGETS: Keep consolidation zones much lower
      const expectedProgress = i / (numCandles - 1);

      // Create consolidation zones that peak at 40% of final target (40k)
      // Much lower targets so price doesn't naturally trend toward high ceilings
      const zonePeak = this.BONDING_MCAP * 0.4; // 40k consolidation zone (much lower!)
      const zoneProgress = Math.min(expectedProgress * 1.0, 1.0); // Normal progression
      const expectedMcap =
        this.INITIAL_MCAP + (zonePeak - this.INITIAL_MCAP) * zoneProgress;

      // ZONE-AWARE: Only apply mean reversion if price hasn't broken out significantly
      // If price has broken 50% above the zone target, let it run free (natural breakout)
      const breakoutThreshold = expectedMcap * 1.5; // 50% above zone target (higher threshold)
      const hasBrokenOut = currentMcap > breakoutThreshold;

      let marketMemory = 0;
      if (!hasBrokenOut) {
        // Normal mean reversion toward consolidation zone
        const deviationPercent =
          (expectedMcap - currentMcap) / Math.abs(currentMcap || 1);
        marketMemory = deviationPercent * 0.008; // Slightly weaker for lower targets
      }
      // If broken out, marketMemory = 0 (no artificial pullback)

      // Combine stochastic forces: random walk + momentum + memory + cycles
      const totalChangePercent =
        randomShock +
        momentumInfluence +
        memoryInfluence +
        cycleInfluence +
        marketMemory;

      // Update momentum based on recent price action (reduced accumulation)
      shortTermMomentum = shortTermMomentum * 0.85 + totalChangePercent * 0.15;
      longTermMemory = longTermMemory * 0.97 + totalChangePercent * 0.03;

      const open = currentMcap;
      let close = open * (1 + totalChangePercent);

      // NO CEILING: Let stochastic process run completely free to see maximum extremes
      // Remove all artificial constraints - true mathematical exploration
      const preBondingCeiling = this.BONDING_MCAP * 1000; // 100 million - effectively infinite
      if (close > preBondingCeiling) {
        close = preBondingCeiling;
      }

      // Generate realistic OHLC using statistical distributions
      const bodySize = Math.abs(close - open);
      const isGreen = close >= open;

      // Very conservative wicks for 1-minute crypto candles (realistic range)
      const wickMultiplier = 0.5 + this.rng() * 0.8; // 0.5x to 1.3x the body size
      const highWick = bodySize * wickMultiplier;
      const lowWick = bodySize * wickMultiplier * 0.85;

      let high = Math.max(open, close) + highWick;
      let low = Math.min(open, close) - lowWick;

      // Realistic intraday swings for 1-minute crypto candles
      const maxSwing = Math.max(bodySize * 1.5, currentMcap * 0.05); // Max 5% swing per minute
      high = Math.min(high, open + maxSwing);
      low = Math.max(low, open - maxSwing);

      // PRE-BONDING: Wicks can go up to 100M (effectively no limits)
      high = Math.min(high, preBondingCeiling);
      low = Math.max(low, 0); // Also prevent negative prices

      // Volume modeling using statistical distribution
      const baseVolume = volumeAvg;
      const volumeMultiplier = 1 + Math.abs(totalChangePercent) * 3; // Higher volume on bigger moves
      const volumeNoise = this.gaussianRandom() * 0.3; // 30% volume variance
      let volume = baseVolume * volumeMultiplier * (1 + volumeNoise);
      volume = Math.max(10000, volume); // Minimum volume

      // Update volume average using exponential moving average
      volumeAvg = volumeAvg * 0.98 + volume * 0.02;

      candles.push({
        open,
        high,
        low,
        close,
        volume,
      });

      currentMcap = close;
    }

    // REMOVE ARTIFICIAL SCALING: Let stochastic process naturally approach bonding curve
    // No forced jump to exactly 100k - organic price discovery only

    return candles;
  }

  generatePostBonding(startMcap, scenario, volatility) {
    const numCandles = this.randomInt(500, 1500);

    switch (scenario) {
      case "organic":
        return this.generateOrganic(startMcap, numCandles, volatility);
      case "pump_dump":
        return this.generatePumpDump(startMcap, numCandles, volatility);
      case "instant_rug":
        return this.generateInstantRug(startMcap, numCandles, volatility);
      case "slow_bleed":
        return this.generateSlowBleed(startMcap, numCandles, volatility);
      case "consolidation":
        return this.generateConsolidation(startMcap, numCandles, volatility);
      default:
        return this.generateOrganic(startMcap, numCandles, volatility);
    }
  }

  generateOrganic(startMcap, numCandles, volatility) {
    const candles = [];
    let currentMcap = startMcap;

    const volMap = {
      low: 0.012,
      medium: 0.02,
      high: 0.03,
      extreme: 0.04,
    };
    const vol = volMap[volatility] || 0.02;

    // POST-BONDING: Mean reversion around $100k - CAN GO BELOW BUT NEVER ABOVE
    const meanReversionLevel = this.BONDING_MCAP;
    const meanReversionSpeed = 0.05; // How strongly it pulls back to mean

    let volumeAvg = this.stats.mean([80000, 120000]);

    for (let i = 0; i < numCandles; i++) {
      // Mean reversion component - pulls price back toward $100k
      const deviation = (currentMcap - meanReversionLevel) / meanReversionLevel;
      const meanReversionForce = -deviation * meanReversionSpeed;

      // Random walk with drift toward mean
      const diffusion = this.gaussianRandom() * vol;

      // Slight upward bias for organic growth (but capped at $100k)
      const organicDrift = 0.0005; // Very small upward trend

      // Seasonal/market cycle component
      const cycle = Math.sin(i * 0.02) * vol * 0.2;

      const change = meanReversionForce + diffusion + organicDrift + cycle;

      const open = currentMcap;
      let close = open * (1 + change);

      // CRITICAL: NEVER exceed bonding curve ceiling
      if (close > this.BONDING_MCAP) {
        close = this.BONDING_MCAP;
      }

      // Generate OHLC with statistical wicks
      const bodySize = Math.abs(close - open);
      const wickMultipliers = [0.2, 0.4, 0.6, 0.8];
      const wickMultiplier =
        wickMultipliers[Math.floor(this.rng() * wickMultipliers.length)];

      let high = Math.max(open, close) + bodySize * wickMultiplier * this.rng();
      let low =
        Math.min(open, close) - bodySize * wickMultiplier * this.rng() * 0.7;

      // Ensure wicks don't violate the ceiling
      high = Math.min(high, this.BONDING_MCAP * 1.005); // Allow slight overshoot on wick
      low = Math.max(low, currentMcap * 0.9); // Max 10% drop

      // Volume modeling
      const baseVolume = volumeAvg;
      const volumeMultiplier = 1 + Math.abs(change) * 2;
      const volumeNoise = this.gaussianRandom() * 0.25;
      let volume = baseVolume * volumeMultiplier * (1 + volumeNoise);
      volume = Math.max(15000, volume);

      volumeAvg = volumeAvg * 0.99 + volume * 0.01;

      candles.push({ open, high, low, close, volume });
      currentMcap = close;
    }

    return candles;
  }

  generatePumpDump(startMcap, numCandles, volatility) {
    const candles = [];
    let currentMcap = startMcap;

    const volMap = {
      low: 0.025,
      medium: 0.035,
      high: 0.045,
      extreme: 0.055,
    };
    const vol = volMap[volatility] || 0.035;

    // POST-BONDING PUMP & DUMP: Can go below but NEVER above $100k
    // Realistic pump: tries to break ceiling but gets rejected
    const phases = [
      {
        name: "accumulation",
        duration: Math.floor(numCandles * 0.25),
        drift: 0.002,
        volMult: 0.8,
      },
      {
        name: "pump",
        duration: Math.floor(numCandles * 0.25),
        drift: 0.008, // Aggressive pump toward ceiling
        volMult: 2.0,
      },
      {
        name: "distribution",
        duration: Math.floor(numCandles * 0.15),
        drift: -0.001,
        volMult: 1.5,
      },
      {
        name: "dump",
        duration: Math.floor(numCandles * 0.35),
        drift: -0.015,
        volMult: 2.5,
      },
    ];

    let volumeAvg = this.stats.mean([100000, 150000]);
    let candleCount = 0;

    for (const phase of phases) {
      for (let i = 0; i < phase.duration && candleCount < numCandles; i++) {
        const progress = i / phase.duration;

        let phaseDrift = phase.drift;

        // During pump phase, accelerate toward ceiling but get rejected
        if (phase.name === "pump") {
          const distanceToCeiling =
            (this.BONDING_MCAP - currentMcap) / currentMcap;
          if (distanceToCeiling < 0.05) {
            // Close to ceiling
            phaseDrift *= 0.3; // Slow down near ceiling
          }
        }

        const noise = this.gaussianRandom() * vol * phase.volMult;
        const change = phaseDrift + noise;

        const open = currentMcap;
        let close = open * (1 + change);

        // CRITICAL: NEVER exceed bonding curve ceiling
        if (close > this.BONDING_MCAP) {
          close = this.BONDING_MCAP;
          // During pump phase, create rejection candles
          if (phase.name === "pump") {
            close = this.BONDING_MCAP * (0.995 + this.rng() * 0.01); // Slight pullback
          }
        }

        // Generate OHLC with exaggerated wicks during pump/dump
        const bodySize = Math.abs(close - open);
        const wickMultiplier = phase.volMult * 0.8;

        let high =
          Math.max(open, close) + bodySize * wickMultiplier * this.rng();
        let low =
          Math.min(open, close) - bodySize * wickMultiplier * this.rng() * 0.6;

        // Ensure wicks don't violate ceiling
        high = Math.min(high, this.BONDING_MCAP * 1.01); // Small overshoot allowed on wick
        low = Math.max(low, currentMcap * 0.85); // Max 15% drop

        // Volume spikes during pump/dump
        const baseVolume = volumeAvg * phase.volMult;
        const volumeMultiplier = 1 + Math.abs(change) * 4;
        const volumeNoise = this.gaussianRandom() * 0.4;
        let volume = baseVolume * volumeMultiplier * (1 + volumeNoise);
        volume = Math.max(20000, volume);

        volumeAvg = volumeAvg * 0.98 + volume * 0.02;

        candles.push({ open, high, low, close, volume });
        currentMcap = close;
        candleCount++;
      }
    }

    return candles;
  }

  generateInstantRug(startMcap, numCandles, volatility) {
    const candles = [];
    let currentMcap = startMcap;
    const rugPoint = this.randomInt(10, 30);

    const volMap = {
      low: 0.01,
      medium: 0.02,
      high: 0.03,
      extreme: 0.04,
    };
    const vol = volMap[volatility] || 0.02;

    for (let i = 0; i < numCandles; i++) {
      let change, volume;

      if (i < rugPoint) {
        // Pre-rug: slight pump
        change = this.random(-vol * 0.5, vol * 1.5);
        volume = 100000 + Math.random() * 50000;
      } else if (i === rugPoint) {
        // The rug
        change = -this.random(0.85, 0.95);
        volume = 500000 + Math.random() * 500000;
      } else {
        // Post-rug: dead
        change = this.random(-0.001, 0.001);
        volume = 1000 + Math.random() * 5000;
      }

      const open = currentMcap;
      const close = Math.max(this.INITIAL_MCAP * 0.1, open * (1 + change));

      const wickFactor = i === rugPoint ? 0.2 : 0.5;
      const wickSize = vol * currentMcap * wickFactor;
      const high = Math.max(open, close) + Math.random() * wickSize;
      const low = Math.min(open, close) - Math.random() * wickSize * 2;

      candles.push({ open, high, low, close, volume });
      currentMcap = close;
    }

    return candles;
  }

  generateSlowBleed(startMcap, numCandles, volatility) {
    const candles = [];
    let currentMcap = startMcap;

    const volMap = {
      low: 0.01,
      medium: 0.015,
      high: 0.02,
      extreme: 0.025,
    };
    const vol = volMap[volatility] || 0.015;

    // Target 10-20% of starting
    const targetMcap = startMcap * this.random(0.1, 0.2);
    const totalDecline = Math.log(targetMcap / startMcap);
    const baseDecline = totalDecline / numCandles;

    for (let i = 0; i < numCandles; i++) {
      const progress = i / numCandles;

      // Accelerating decline
      const decline = baseDecline * (1 + progress * 2);

      // Occasional relief rally
      const hasRally = Math.random() < 0.08;
      const rally = hasRally ? Math.abs(this.gaussianRandom()) * vol * 2 : 0;

      const noise = this.gaussianRandom() * vol;
      const change = decline + noise + rally;

      const open = currentMcap;
      const close = Math.max(this.INITIAL_MCAP * 0.5, open * (1 + change));

      const wickSize = vol * currentMcap * 0.5;
      const high = Math.max(open, close) + Math.random() * wickSize;
      const low = Math.min(open, close) - Math.random() * wickSize;

      // Declining volume
      const volume = 100000 - progress * 70000 + Math.random() * 30000;

      candles.push({ open, high, low, close, volume });
      currentMcap = close;
    }

    return candles;
  }

  generateConsolidation(startMcap, numCandles, volatility) {
    const candles = [];
    let currentMcap = startMcap;

    const volMap = {
      low: 0.008,
      medium: 0.012,
      high: 0.016,
      extreme: 0.02,
    };
    const vol = volMap[volatility] || 0.012;

    const consolidationEnd = Math.floor(numCandles * 0.7);
    const breakoutUp = Math.random() > 0.5;

    // Define range
    const rangeHigh = startMcap * 1.1;
    const rangeLow = startMcap * 0.9;
    const rangeCenter = (rangeHigh + rangeLow) / 2;

    for (let i = 0; i < numCandles; i++) {
      let change, volume;

      if (i < consolidationEnd) {
        // Consolidation: bounce between support and resistance
        const rangeProgress = i / consolidationEnd;
        const rangeTightening = 1 - rangeProgress * 0.5;

        // Oscillate within range
        const distFromCenter = (currentMcap - rangeCenter) / rangeCenter;
        const pullToCenter = -distFromCenter * 0.1;

        change =
          pullToCenter +
          Math.sin(i * 0.15) * vol * rangeTightening +
          this.gaussianRandom() * vol * 0.5;
        volume = 60000 + Math.random() * 40000;
      } else {
        // Breakout
        const breakoutProgress =
          (i - consolidationEnd) / (numCandles - consolidationEnd);
        const breakoutStrength =
          (breakoutUp ? 0.008 : -0.008) * (1 + breakoutProgress);

        change = breakoutStrength + this.gaussianRandom() * vol;
        volume = 150000 + Math.random() * 100000;
      }

      const open = currentMcap;
      const close = open * (1 + change);

      const wickSize = vol * currentMcap * 0.3;
      const high = Math.max(open, close) + Math.random() * wickSize;
      const low = Math.min(open, close) - Math.random() * wickSize;

      candles.push({ open, high, low, close, volume });
      currentMcap = close;
    }

    return candles;
  }

  calculateMetadata(data) {
    if (!data || data.length === 0) return {};

    const marketCaps = data.map((d) => d.close);

    return {
      startMcap: marketCaps[0],
      finalMcap: marketCaps[marketCaps.length - 1],
      peakMcap: Math.max(...marketCaps),
      minMcap: Math.min(...marketCaps),
      totalCandles: data.length,
    };
  }
}

// Export for use
window.ChartGenerator = ChartGenerator;
