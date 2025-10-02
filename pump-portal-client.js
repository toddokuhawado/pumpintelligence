// Client for PumpPortal real-time feed with optional mock sandbox stream
(function () {
  const DEFAULT_SOL_PRICE = 220; // USD approximation for market cap conversion
  const DEFAULT_URL = "wss://pumpportal.fun/api/data";

  class PumpPortalClient {
    constructor(options = {}) {
      this.url = options.url || DEFAULT_URL;
      this.onTokenUpdate = options.onTokenUpdate || null;
      this.onEvent = options.onEvent || null;
      this.onStatusChange = options.onStatusChange || null;
      this.marketCapRange = options.marketCapRange || [15000, 30000];
      this.maxTrackedTokens = options.maxTrackedTokens || 80;
      this.solPriceUsd = options.solPriceUsd || DEFAULT_SOL_PRICE;
      this.useMock = options.useMock || false;
      this.defaultSubscriptions = options.defaultSubscriptions || [
        { method: "subscribeNewToken" },
      ];
      this._ws = null;
      this._reconnectTimer = null;
      this._reconnectDelay = 4000;
      this._mockInterval = null;
      this._tokenSnapshots = new Map();
      this._subscribedMints = new Set();
    }

    start() {
      if (this.useMock) {
        this._startMockStream();
      } else {
        this._openSocket();
      }
    }

    stop() {
      if (this._ws) {
        try {
          this._ws.close();
        } catch (err) {
          console.warn("PumpPortalClient stop warning:", err.message);
        }
        this._ws = null;
      }
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
      if (this._mockInterval) {
        clearInterval(this._mockInterval);
        this._mockInterval = null;
      }
      this._subscribedMints.clear();
    }

    setUseMock(enable) {
      if (this.useMock === enable) {
        return;
      }
      this.useMock = enable;
      this.reconnect(true);
    }

    setSolPriceUsd(value) {
      if (value && Number.isFinite(value)) {
        this.solPriceUsd = value;
      }
    }

    reconnect(force = false) {
      if (!force && this._ws && this._ws.readyState === WebSocket.OPEN) {
        return;
      }
      this.stop();
      this._reconnectDelay = 4000;
      this.start();
    }

    _openSocket() {
      this._emitStatus("connecting", "Connecting to PumpPortal");
      let ws;
      try {
        ws = new WebSocket(this.url);
      } catch (error) {
        this._emitStatus("error", error.message || "WebSocket init failed");
        this._scheduleReconnect();
        return;
      }

      this._ws = ws;

      ws.addEventListener("open", () => {
        this._emitStatus("connected", "Live feed streaming");
        this._registerDefaultSubscriptions();
      });

      ws.addEventListener("message", (event) => {
        const payload = this._safeParse(event.data);
        if (!payload) {
          return;
        }
        this._handleEvent(payload);
      });

      ws.addEventListener("error", (event) => {
        console.error("PumpPortal socket error", event);
        this._emitStatus("error", "Socket error");
      });

      ws.addEventListener("close", () => {
        this._emitStatus("disconnected", "Socket closed");
        this._scheduleReconnect();
      });
    }

    _registerDefaultSubscriptions() {
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
        return;
      }
      this.defaultSubscriptions.forEach((payload) => {
        this._sendPayload(payload);
      });
    }

    _subscribeToToken(mint) {
      if (!mint || this.useMock || this._subscribedMints.has(mint)) {
        return;
      }
      this._subscribedMints.add(mint);
      this._sendPayload({ method: "subscribeTokenTrade", keys: [mint] });
    }

    _unsubscribeFromToken(mint) {
      if (!mint || this.useMock || !this._subscribedMints.has(mint)) {
        return;
      }
      this._subscribedMints.delete(mint);
      this._sendPayload({ method: "unsubscribeTokenTrade", keys: [mint] });
    }

    _sendPayload(payload) {
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        this._ws.send(JSON.stringify(payload));
      } catch (error) {
        console.error("PumpPortalClient send error", error);
      }
    }

    _scheduleReconnect() {
      if (this.useMock) {
        return;
      }
      if (this._reconnectTimer) {
        return;
      }
      this._reconnectTimer = setTimeout(() => {
        this._reconnectTimer = null;
        this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, 30000);
        this._openSocket();
      }, this._reconnectDelay);
      this._emitStatus(
        "connecting",
        `Reconnecting in ${Math.round(this._reconnectDelay / 1000)}s`
      );
    }

    _handleEvent(rawEvent) {
      const normalized = this._normalizeEvent(rawEvent);
      if (!normalized) {
        return;
      }

      normalized.inRange = this._isMarketCapWithinRange(normalized.marketCapUsd);

      this._tokenSnapshots.set(normalized.mint, normalized);
      if (this._tokenSnapshots.size > this.maxTrackedTokens) {
        const oldestKey = this._tokenSnapshots.keys().next().value;
        this._tokenSnapshots.delete(oldestKey);
        this._unsubscribeFromToken(oldestKey);
      }

      if (normalized.type === "create") {
        this._subscribeToToken(normalized.mint);
      }

      if (typeof this.onTokenUpdate === "function") {
        try {
          this.onTokenUpdate(normalized, rawEvent);
        } catch (err) {
          console.error("onTokenUpdate handler error", err);
        }
      }

      if (typeof this.onEvent === "function") {
        const description = this._buildDescription(normalized);
        const logPayload = {
          timestamp: normalized.timestamp,
          type: normalized.type,
          description,
          mint: normalized.mint,
          symbol: normalized.symbol,
          important:
            normalized.type === "token_launch" || normalized.type === "create",
        };
        try {
          this.onEvent(logPayload, rawEvent);
        } catch (err) {
          console.error("onEvent handler error", err);
        }
      }
    }

    _isMarketCapWithinRange(value) {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return false;
      }
      const [min, max] = this.marketCapRange;
      return value >= min && value <= max;
    }

    _normalizeEvent(event) {
      const type = String(
        event.type ||
          event.event_type ||
          event.eventType ||
          event.action ||
          event.txType ||
          "unknown"
      ).toLowerCase();
      const mint =
        event.mint || event.token || event.tokenMint || event.address || null;
      if (!mint) {
        return null;
      }

      const timestamp = this._coerceNumber(
        event.timestamp || event.time || event.created_at || Date.now()
      );

      let priceUsd = this._extractUsdValue(event, [
        "priceUsd",
        "price_usd",
        "usdPrice",
        "price",
      ]);

      const marketCapUsd = this._extractUsdValue(event, [
        "marketCap",
        "market_cap",
        "marketCapUsd",
        "market_cap_usd",
        "marketCapSol",
        "market_cap_sol",
      ]);

      const name =
        event.name || event.tokenName || event.project_name || event.collectionName;
      const symbol =
        event.symbol || event.ticker || event.tokenSymbol || event.project_ticker;

      const liquidityUsd = this._extractUsdValue(event, [
        "liquidityUsd",
        "liquidity_usd",
        "liquidity",
        "virtualSolReserves",
        "virtual_sol_reserves",
        "virtualSolReservesUsd",
        "virtual_sol_reserves_usd",
        "realSolReserves",
      ]);

      const solAmount = this._coerceNumber(event.solAmount || event.sol_amount);
      const tokenAmount = this._coerceNumber(
        event.tokenAmount || event.token_amount
      );
      const newTokenBalance = this._coerceNumber(
        event.newTokenBalance || event.new_token_balance
      );

      if (
        (!priceUsd || Number.isNaN(priceUsd)) &&
        typeof solAmount === "number" &&
        typeof tokenAmount === "number" &&
        tokenAmount > 0
      ) {
        priceUsd = (solAmount * this.solPriceUsd) / tokenAmount;
      }

      const launchTimestamp = this._coerceNumber(
        event.launchTimestamp ||
          event.createdAt ||
          event.bonding_created_at ||
          timestamp
      );

      const prev = this._tokenSnapshots.get(mint);
      let priceChangePct = null;
      if (typeof event.priceChangePct === "number") {
        priceChangePct = event.priceChangePct;
      } else if (typeof event.priceChange24h === "number") {
        priceChangePct = event.priceChange24h;
      } else if (
        prev &&
        typeof priceUsd === "number" &&
        priceUsd > 0 &&
        typeof prev.priceUsd === "number" &&
        prev.priceUsd > 0
      ) {
        priceChangePct = ((priceUsd - prev.priceUsd) / prev.priceUsd) * 100;
      }

      return {
        type,
        mint,
        name,
        symbol: symbol || mint.slice(0, 4).toUpperCase(),
        liquidityUsd: liquidityUsd,
        marketCapUsd: marketCapUsd,
        priceUsd: priceUsd,
        priceChangePct: priceChangePct,
        launchTimestamp,
        timestamp,
        solAmount,
        tokenAmount,
        newTokenBalance,
        volumeUsd: this._extractUsdValue(event, [
          "volume",
          "volumeUsd",
          "volume_usd",
        ]),
        raw: event,
      };
    }

    _extractUsdValue(event, keys) {
      for (const key of keys) {
        if (!(key in event)) continue;
        const value = this._coerceNumber(event[key]);
        if (!value || Number.isNaN(value)) continue;

        // Treat lamports where values are large integers
        if (value > 1e10) {
          const sol = value / 1e9;
          return sol * this.solPriceUsd;
        }

        if (key.toLowerCase().includes("sol")) {
          return value * this.solPriceUsd;
        }

        // Found a plausible USD figure
        if (value > 0) {
          return value;
        }
      }
      return null;
    }

    _coerceNumber(input) {
      if (input === undefined || input === null) {
        return null;
      }
      const num = Number(input);
      return Number.isFinite(num) ? num : null;
    }

    _safeParse(data) {
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch (error) {
        console.warn("PumpPortalClient parse failure", error.message);
        return null;
      }
    }

    _buildDescription(token) {
      const parts = [];
      if (token.symbol) {
        parts.push(`${token.symbol}`);
      }
      if (typeof token.marketCapUsd === "number") {
        parts.push(`mcap ${this._formatUsd(token.marketCapUsd)}`);
      } else if (typeof token.liquidityUsd === "number") {
        parts.push(`liq ${this._formatUsd(token.liquidityUsd)}`);
      }
      if (typeof token.priceUsd === "number") {
        parts.push(`price ${this._formatUsd(token.priceUsd)}`);
      }
      if (typeof token.solAmount === "number") {
        const direction = token.type === "buy" ? "buy" : token.type === "sell" ? "sell" : "size";
        parts.push(`${direction} ${token.solAmount.toFixed(4)} SOL`);
      }
      if (typeof token.priceChangePct === "number") {
        const delta = token.priceChangePct;
        const sign = delta >= 0 ? "+" : "";
        parts.push(`Δ ${sign}${delta.toFixed(2)}%`);
      }
      return parts.join(" | ");
    }

    _formatUsd(value) {
      if (value >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(2)}M`;
      }
      if (value >= 1_000) {
        return `$${(value / 1_000).toFixed(1)}K`;
      }
      if (value >= 1) {
        return `$${value.toFixed(2)}`;
      }
      return `$${value.toFixed(4)}`;
    }

    _emitStatus(state, message) {
      if (typeof this.onStatusChange === "function") {
        try {
          this.onStatusChange({ state, message, mock: this.useMock });
        } catch (err) {
          console.error("onStatusChange handler error", err);
        }
      }
    }

    _startMockStream() {
      this._emitStatus("mock", "Mock sandbox feed active");
      const seed = Date.now();
      const random = this._mulberry32(seed);

      const emitMock = () => {
        const now = Date.now();
        const mint = `MOCK${Math.floor(random() * 1e6)}`;
        const marketCap =
          this.marketCapRange[0] +
          random() * (this.marketCapRange[1] - this.marketCapRange[0]);
        const price = 0.0001 + random() * 0.01;
        const change = (random() - 0.5) * 20;
        const payload = {
          type: "token_launch",
          mint,
          name: `Mock Token ${mint.slice(-3)}`,
          symbol: `MK${mint.slice(-2)}`,
          liquidityUsd: marketCap / 2,
          marketCapUsd: marketCap,
          priceUsd: price,
          priceChangePct: change,
          launchTimestamp: now - random() * 60000,
          timestamp: now,
        };
        this._handleEvent(payload);
      };

      emitMock();
      this._mockInterval = setInterval(emitMock, 3500);
    }

    _mulberry32(a) {
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  }

  window.PumpPortalClient = PumpPortalClient;
})();
