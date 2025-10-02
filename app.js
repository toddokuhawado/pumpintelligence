// Import series types from lightweight-charts
const {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  LineSeries,
} = LightweightCharts;

// Initialize the app
let chart = null;
let candlestickSeries = null;
let volumeSeries = null;
let currentData = null;
let generator = null;

// Pump Portal live feed state
let pumpClient = null;
const pumpTokens = new Map();
const pumpCandles = new Map();
const pumpTrades = new Map();
const pumpLogEntries = [];
const pumpDom = {};
const PUMP_MAX_ROWS = 40;
const PUMP_MAX_LOG_ENTRIES = 150;
const PUMP_CANDLE_INTERVAL_MS = 1000; // 1-second buckets
const PUMP_MAX_CANDLES_PER_TOKEN = 1200; // Keep ~20 minutes of history
const PUMP_MAX_TRADES_PER_TOKEN = 200;
const tokenMetadataCache = new Map();
const tokenMetadataPending = new Set();
let activePumpMint = null;
let activePumpRenderedMint = null;
let activePumpRenderedLastTime = 0;
let pumpChartAutoRange = true;
let pumpSuppressRangeEvent = false;
const taOverlayState = {
  series: [],
  priceLines: [],
};

// Initialize chart when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  generator = new ChartGenerator();
  initChart();
  setupEventListeners();
  initPumpPortalUI();
  generateNewChart();
});

function initChart() {
  const chartContainer = document.getElementById("chart");

  chart = createChart(chartContainer, {
    width: chartContainer.clientWidth,
    height: 600,
    layout: {
      background: { color: "#131722" },
      textColor: "#d1d4dc",
    },
    grid: {
      vertLines: { color: "#2a2e39" },
      horzLines: { color: "#2a2e39" },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: "#2a2e39",
      scaleMargins: {
        top: 0.05,
        bottom: 0.15,
      },
    },
    timeScale: {
      borderColor: "#2a2e39",
      timeVisible: true,
      secondsVisible: false,
    },
  });

  // Create candlestick series using the new API
  candlestickSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#00ff88",
    downColor: "#ff4444",
    borderUpColor: "#00ff88",
    borderDownColor: "#ff4444",
    wickUpColor: "#00ff88",
    wickDownColor: "#ff4444",
    priceFormat: {
      type: "custom",
      formatter: (price) => {
        if (price >= 1000000) {
          return "$" + (price / 1000000).toFixed(2) + "M";
        } else if (price >= 1000) {
          return "$" + (price / 1000).toFixed(1) + "K";
        }
        return "$" + price.toFixed(0);
      },
    },
  });

  // Volume chart removed - too distracting for price analysis
  // volumeSeries = chart.addSeries(HistogramSeries, {
  //   color: "#26a69a",
  //   priceFormat: {
  //     type: "volume",
  //   },
  //   priceScaleId: "volume",
  //   scaleMargins: {
  //     top: 0.85,
  //     bottom: 0.05,
  //   },
  // });

  // Handle resize
  window.addEventListener("resize", () => {
    chart.applyOptions({ width: chartContainer.clientWidth });
  });

  chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
    if (pumpSuppressRangeEvent) {
      return;
    }
    pumpChartAutoRange = false;
  });
}

function setupEventListeners() {
  document
    .getElementById("generateBtn")
    .addEventListener("click", generateNewChart);
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document
    .getElementById("exportImageBtn")
    .addEventListener("click", exportImage);
  document
    .getElementById("analyzeBtn")
    .addEventListener("click", analyzeChart);
}

function initPumpPortalUI() {
  pumpDom.statusBadge = document.getElementById("pumpStatusBadge");
  pumpDom.mockToggle = document.getElementById("pumpMockToggle");
  pumpDom.reconnectBtn = document.getElementById("pumpReconnectBtn");
  pumpDom.clearLogBtn = document.getElementById("pumpClearLogBtn");
  pumpDom.tokenTable = document.getElementById("pumpTokenTable");
  pumpDom.tokenEmpty = document.getElementById("pumpTokenEmpty");
  pumpDom.log = document.getElementById("pumpLog");
  pumpDom.metaPanel = document.getElementById("tokenMetaPanel");
  pumpDom.metaAvatar = document.getElementById("tokenMetaAvatar");
  pumpDom.metaTitle = document.getElementById("tokenMetaTitle");
  pumpDom.metaMintLink = document.getElementById("tokenMetaMintLink");
  pumpDom.metaUriLink = document.getElementById("tokenMetaUriLink");
  pumpDom.tradesPanel = document.getElementById("pumpTradesPanel");
  pumpDom.tradesTable = document.getElementById("pumpTradesTable");

  if (pumpDom.metaPanel) {
    pumpDom.metaPanel.classList.remove("visible");
  }
  if (pumpDom.tradesPanel) {
    pumpDom.tradesPanel.classList.remove("visible");
  }

  renderPumpTokenTable();
  renderPumpLog();
  renderPumpTrades();

  if (!pumpDom.statusBadge) {
    console.warn("Pump Portal status badge missing in DOM");
    return;
  }

  if (typeof PumpPortalClient !== "function") {
    pumpDom.statusBadge.className = "status-badge error";
    pumpDom.statusBadge.textContent = "Unavailable";
    pumpDom.statusBadge.title = "PumpPortalClient script not loaded";
    return;
  }

  pumpClient = new PumpPortalClient({
    marketCapRange: [15000, 30000],
    onTokenUpdate: handlePumpTokenUpdate,
    onEvent: handlePumpEventLog,
    onStatusChange: handlePumpStatus,
  });

  if (pumpDom.mockToggle) {
    pumpDom.mockToggle.addEventListener("change", (event) => {
      const enableMock = Boolean(event.target.checked);
      if (pumpClient) {
        pumpTokens.clear();
        renderPumpTokenTable();
        pumpClient.setUseMock(enableMock);
      }
    });
  }

  if (pumpDom.reconnectBtn) {
    pumpDom.reconnectBtn.addEventListener("click", () => {
      if (pumpClient) {
        pumpClient.reconnect(true);
      }
    });
  }

  if (pumpDom.clearLogBtn) {
    pumpDom.clearLogBtn.addEventListener("click", () => {
      pumpLogEntries.length = 0;
      renderPumpLog();
    });
  }

  pumpClient.start();
  refreshSolPriceEstimate();

  if (pumpDom.tokenTable) {
    pumpDom.tokenTable.addEventListener("click", handlePumpTokenClick);
  }
}

async function refreshSolPriceEstimate() {
  if (typeof fetch !== "function" || !pumpClient) {
    return;
  }
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const data = await response.json();
    const price = data?.solana?.usd;
    if (typeof price === "number" && Number.isFinite(price)) {
      pumpClient.setSolPriceUsd(price);
      logPumpSystemMessage(`SOL price updated: $${price.toFixed(2)}`);
    }
  } catch (error) {
    console.warn("Failed to refresh SOL price", error);
  }
}

function handlePumpTokenUpdate(token) {
  const existing = pumpTokens.get(token.mint) || {};
  const merged = {
    ...existing,
    ...token,
    name: token.name || existing.name,
    symbol: token.symbol || existing.symbol,
    raw: { ...(existing.raw || {}), ...(token.raw || {}) },
    firstSeenAt: existing.firstSeenAt || token.timestamp || existing.timestamp,
  };

  merged.isNew = existing.isNew === undefined ? token.type === "create" : existing.isNew;

  if (
    typeof merged.marketCapUsd !== "number" ||
    Number.isNaN(merged.marketCapUsd)
  ) {
    merged.marketCapUsd = existing.marketCapUsd;
  }
  if (typeof merged.priceUsd !== "number" || Number.isNaN(merged.priceUsd)) {
    merged.priceUsd = existing.priceUsd;
  }
  if (
    typeof merged.priceChangePct !== "number" ||
    Number.isNaN(merged.priceChangePct)
  ) {
    merged.priceChangePct = existing.priceChangePct;
  }

  if (
    merged.isNew &&
    merged.firstSeenAt &&
    token.timestamp &&
    token.timestamp - merged.firstSeenAt > 180_000
  ) {
    merged.isNew = false;
  }

  pumpTokens.set(token.mint, merged);

  // Keep most recent tokens only
  if (pumpTokens.size > PUMP_MAX_ROWS * 2) {
    const entries = Array.from(pumpTokens.entries()).sort(
      (a, b) => b[1].timestamp - a[1].timestamp
    );
    const keepEntries = entries.slice(0, PUMP_MAX_ROWS * 2);
    const keepSet = new Set(keepEntries.map(([mint]) => mint));
    pumpTokens.clear();
    for (const [mint, payload] of keepEntries) {
      pumpTokens.set(mint, payload);
    }
    for (const mint of pumpCandles.keys()) {
      if (!keepSet.has(mint)) {
        pumpCandles.delete(mint);
      }
    }
    for (const mint of pumpTrades.keys()) {
      if (!keepSet.has(mint)) {
        pumpTrades.delete(mint);
      }
    }
  }

  updatePumpCandles(merged);

  recordPumpTrade(merged);

  renderPumpTokenTable();

  if (activePumpMint === token.mint) {
    renderActivePumpToken();
    renderPumpTrades();
  }
}

function recordPumpTrade(token) {
  if (token.type !== "buy" && token.type !== "sell") {
    return;
  }

  const trades = pumpTrades.get(token.mint) || [];
  const priceUsd = typeof token.priceUsd === "number"
    ? token.priceUsd
    : token.solAmount && token.tokenAmount
    ? (token.solAmount * (pumpClient?.solPriceUsd || 0)) / token.tokenAmount
    : null;

  trades.push({
    type: token.type,
    priceUsd,
    solAmount: token.solAmount,
    tokenAmount: token.tokenAmount,
    marketCapUsd: token.marketCapUsd,
    timestamp: token.timestamp || Date.now(),
  });

  if (trades.length > PUMP_MAX_TRADES_PER_TOKEN) {
    trades.splice(0, trades.length - PUMP_MAX_TRADES_PER_TOKEN);
  }

  pumpTrades.set(token.mint, trades);
  console.debug("Pump trade", token);
}

function renderPumpTokenTable() {
  if (!pumpDom.tokenTable) {
    return;
  }

  const rows = Array.from(pumpTokens.values()).sort((a, b) => {
    const aCap = Number.isFinite(a.marketCapUsd) ? a.marketCapUsd : -Infinity;
    const bCap = Number.isFinite(b.marketCapUsd) ? b.marketCapUsd : -Infinity;
    if (aCap !== bCap) {
      return bCap - aCap;
    }
    const aTime = a.timestamp || 0;
    const bTime = b.timestamp || 0;
    return bTime - aTime;
  });
  const limited = rows
    .filter((token) => token.inRange || token.isNew)
    .slice(0, PUMP_MAX_ROWS);

  pumpDom.tokenTable.innerHTML = limited
    .map((token) => {
      const change = token.priceChangePct;
      const changeClass =
        typeof change === "number"
          ? change >= 0
            ? "token-change positive"
            : "token-change negative"
          : "token-change";
      const rowClass = token.isNew
        ? "token-row-new"
        : token.inRange
        ? ""
        : "token-row-out";
      const statusLabel = token.isNew
        ? "NEW"
        : token.inRange
        ? "IN RANGE"
        : "WATCH";
      const statusClass = token.isNew
        ? "token-tag new"
        : token.inRange
        ? "token-tag in-range"
        : "token-tag watch";
      const selectedClass = token.mint === activePumpMint ? " token-row-selected" : "";
      const nameLine = token.name || token.symbol || token.mint.slice(0, 4);
      const mintLabel = `${token.mint.slice(0, 8)}...`;

      return `
        <tr class="${rowClass}${selectedClass}" data-mint="${token.mint}">
          <td>
            <div class="token-symbol" title="${nameLine}">${nameLine}</div>
            <div style="color:#5c5f6d; font-size:11px;" title="${token.mint}">${mintLabel}</div>
            <div class="${statusClass}">${statusLabel}</div>
          </td>
          <td class="token-marketcap">${formatPumpUsd(token.marketCapUsd)}</td>
          <td>${formatPumpPrice(token.priceUsd)}</td>
          <td class="${changeClass}">${formatPumpChange(change)}</td>
          <td>${formatPumpAge(token.launchTimestamp)}</td>
        </tr>
      `;
    })
    .join("");

  if (pumpDom.tokenEmpty) {
    pumpDom.tokenEmpty.style.display = limited.length ? "none" : "block";
  }
}

function handlePumpEventLog(entry) {
  pumpLogEntries.unshift(entry);
  if (pumpLogEntries.length > PUMP_MAX_LOG_ENTRIES) {
    pumpLogEntries.length = PUMP_MAX_LOG_ENTRIES;
  }
  renderPumpLog();
}

function logPumpSystemMessage(message) {
  handlePumpEventLog({
    timestamp: Date.now(),
    type: "system",
    description: message,
    important: false,
  });
}

function renderPumpLog() {
  if (!pumpDom.log) {
    return;
  }

  if (pumpLogEntries.length === 0) {
    pumpDom.log.innerHTML = '<div class="log-line">Awaiting events…</div>';
    return;
  }

  pumpDom.log.innerHTML = pumpLogEntries
    .map((entry) => {
      const date = entry.timestamp ? new Date(entry.timestamp) : new Date();
      const time = date.toLocaleTimeString([], { hour12: false });
      const classes = entry.important ? "log-line important" : "log-line";
      return `
        <div class="${classes}">
          <span class="timestamp">${time}</span>
          <span class="event-type">${entry.type || "event"}</span>
          <span>${entry.description || ""}</span>
        </div>
      `;
    })
    .join("");
}

function handlePumpStatus(status) {
  if (!pumpDom.statusBadge) {
    return;
  }

  const { state, message, mock } = status;
  const badge = pumpDom.statusBadge;
  const labelMap = {
    connecting: "Connecting",
    connected: "Live",
    disconnected: "Offline",
    error: "Error",
    mock: "Mock",
  };
  const classMap = {
    connecting: "connecting",
    connected: "connected",
    disconnected: "disconnected",
    error: "error",
    mock: "connected",
  };

  const resolvedState = mock ? "mock" : state;
  const statusClass = classMap[resolvedState] || "disconnected";
  badge.className = `status-badge ${statusClass}`;
  badge.textContent = mock ? "Mock Feed" : labelMap[state] || "Offline";
  if (message) {
    badge.title = message;
  }

  if (pumpDom.mockToggle && pumpDom.mockToggle.checked !== mock) {
    pumpDom.mockToggle.checked = mock;
  }
}

function handlePumpTokenClick(event) {
  const row = event.target.closest("tr[data-mint]");
  if (!row) {
    return;
  }
  const mint = row.getAttribute("data-mint");
  focusPumpToken(mint);
}

function focusPumpToken(mint) {
  if (!mint) {
    return;
  }
  activePumpMint = mint;
  activePumpRenderedMint = null;
  activePumpRenderedLastTime = 0;
  pumpChartAutoRange = true;
  clearTechnicalOverlays();
  renderPumpTokenTable();
  renderActivePumpToken();
  renderPumpTrades();
}

function renderActivePumpToken() {
  if (!activePumpMint) {
    return;
  }
  clearTechnicalOverlays();
  const candles = getPumpCandles(activePumpMint);
  if (!candles.length) {
    candlestickSeries.setData([]);
    return;
  }
  const lastCandle = candles[candles.length - 1];

  const needsFullRefresh =
    activePumpRenderedMint !== activePumpMint ||
    !activePumpRenderedLastTime ||
    lastCandle.time < activePumpRenderedLastTime;
  if (needsFullRefresh) {
    candlestickSeries.setData(candles);
    if (pumpChartAutoRange) {
      pumpSuppressRangeEvent = true;
      chart.timeScale().fitContent();
      setTimeout(() => {
        pumpSuppressRangeEvent = false;
      }, 0);
    }
  } else {
    candlestickSeries.update(lastCandle);
  }

  activePumpRenderedMint = activePumpMint;
  activePumpRenderedLastTime = lastCandle.time;

  const token = pumpTokens.get(activePumpMint);
  if (token) {
    updateInfoFromPumpToken(token);
    runAutoTAForCandles(candles, token);
  }
}

function updatePumpCandles(token) {
  let metric =
    typeof token.marketCapUsd === "number" ? token.marketCapUsd : null;
  if ((metric === null || Number.isNaN(metric)) && token.raw?.marketCapSol) {
    metric = token.raw.marketCapSol * (pumpClient?.solPriceUsd || 0);
  }
  if (
    (metric === null || Number.isNaN(metric)) &&
    typeof token.priceUsd === "number" &&
    typeof token.newTokenBalance === "number"
  ) {
    metric = token.priceUsd * token.newTokenBalance;
  }
  if (
    metric === null ||
    Number.isNaN(metric) ||
    typeof token.timestamp !== "number"
  ) {
    return;
  }

  let mintCandles = pumpCandles.get(token.mint);
  if (!mintCandles) {
    mintCandles = new Map();
    pumpCandles.set(token.mint, mintCandles);
  }

  const bucketMs = PUMP_CANDLE_INTERVAL_MS;
  const bucket = Math.floor(token.timestamp / bucketMs) * bucketMs;
  const timeSeconds = Math.floor(bucket / 1000);

  let candle = mintCandles.get(bucket);
  if (!candle) {
    const previousCandles = getPumpCandles(token.mint);
    const previousClose = previousCandles.length
      ? previousCandles[previousCandles.length - 1].close
      : metric;
    candle = {
      time: timeSeconds,
      open: previousClose,
      high: Math.max(metric, previousClose),
      low: Math.min(metric, previousClose),
      close: metric,
      volume: 0,
    };
    mintCandles.set(bucket, candle);
  } else {
    candle.high = Math.max(candle.high, metric);
    candle.low = Math.min(candle.low, metric);
    candle.close = metric;
  }

  if (typeof token.solAmount === "number") {
    const volumeAddition =
      token.solAmount * (pumpClient?.solPriceUsd || pumpClient?.solPriceUsd === 0
        ? pumpClient.solPriceUsd
        : 0);
    if (!Number.isNaN(volumeAddition)) {
      candle.volume = (candle.volume || 0) + volumeAddition;
    }
  }

  // Limit stored candles per token to avoid unbounded growth
  if (mintCandles.size > PUMP_MAX_CANDLES_PER_TOKEN) {
    const sortedKeys = Array.from(mintCandles.keys()).sort((a, b) => a - b);
    while (sortedKeys.length > PUMP_MAX_CANDLES_PER_TOKEN) {
      const oldest = sortedKeys.shift();
      mintCandles.delete(oldest);
    }
  }
}

function getPumpCandles(mint) {
  const mintCandles = pumpCandles.get(mint);
  if (!mintCandles) {
    return [];
  }
  return Array.from(mintCandles.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, candle]) => candle);
}

function updateInfoFromPumpToken(token) {
  updateTokenMetaPanel(token);

  document.getElementById("chartId").textContent = token.mint.slice(0, 16) + "...";
  document.getElementById("scenarioInfo").textContent = token.name || token.symbol || "Live Token";
  document.getElementById("startMcap").textContent = formatPumpUsd(token.marketCapUsd);
  document.getElementById("peakMcap").textContent = formatPumpUsd(
    token.raw?.athMarketCapUsd || token.marketCapUsd
  );
  document.getElementById("finalMcap").textContent = formatPumpUsd(token.marketCapUsd);
  document.getElementById("totalCandles").textContent = getPumpCandles(token.mint).length;
}

function updateTokenMetaPanel(token) {
  if (!pumpDom.metaPanel) {
    return;
  }

  const title = token.name || token.symbol || token.mint.slice(0, 6) + "...";
  pumpDom.metaTitle.textContent = title;

  if (pumpDom.metaAvatar) {
    pumpDom.metaAvatar.src = generateFallbackAvatar(title);
  }

  if (pumpDom.metaMintLink) {
    pumpDom.metaMintLink.href = `https://pump.fun/${token.mint}`;
  }

  if (pumpDom.metaUriLink) {
    const uri = normalizeTokenUri(token.raw?.uri);
    if (uri) {
      pumpDom.metaUriLink.href = uri;
      pumpDom.metaUriLink.style.display = "inline";
    } else {
      pumpDom.metaUriLink.href = "#";
      pumpDom.metaUriLink.style.display = "none";
    }
  }

  pumpDom.metaPanel.classList.add("visible");

  ensureTokenMetadata(token).then((meta) => {
    if (!meta || !pumpDom.metaAvatar) {
      return;
    }
    const imageUrl = normalizeTokenUri(meta.image || meta.image_url || meta.thumbnail);
    if (imageUrl) {
      pumpDom.metaAvatar.src = imageUrl;
    } else {
      pumpDom.metaAvatar.src = generateFallbackAvatar(title);
    }
  });
}

function renderPumpTrades() {
  if (!pumpDom.tradesPanel || !pumpDom.tradesTable) {
    return;
  }

  if (!activePumpMint) {
    pumpDom.tradesPanel.classList.remove("visible");
    pumpDom.tradesTable.innerHTML = "";
    return;
  }

  const trades = pumpTrades.get(activePumpMint) || [];
  if (!trades.length) {
    pumpDom.tradesPanel.classList.remove("visible");
    pumpDom.tradesTable.innerHTML = "";
    return;
  }

  pumpDom.tradesPanel.classList.add("visible");
  pumpDom.tradesTable.innerHTML = trades
    .slice()
    .reverse()
    .map((trade) => {
      return `
        <tr class="${trade.type}">
          <td>${trade.type.toUpperCase()}</td>
          <td>${formatPumpPrice(trade.priceUsd)}</td>
          <td>${formatPumpSol(trade.solAmount)}</td>
          <td>${formatPumpTokenAmount(trade.tokenAmount)}</td>
          <td>${formatPumpUsd(trade.marketCapUsd)}</td>
          <td>${formatPumpTime(trade.timestamp)}</td>
        </tr>
      `;
    })
    .join("");
}

function ensureTokenMetadata(token) {
  const mint = token.mint;
  const cached = tokenMetadataCache.get(mint);
  if (cached) {
    return Promise.resolve(cached);
  }

  const uri = normalizeTokenUri(token.raw?.uri);
  if (!uri || tokenMetadataPending.has(mint)) {
    return Promise.resolve(null);
  }

  tokenMetadataPending.add(mint);

  return fetch(uri)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Metadata fetch failed: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      tokenMetadataCache.set(mint, data);
      return data;
    })
    .catch((error) => {
      console.warn("Token metadata fetch error", error.message);
      return null;
    })
    .finally(() => {
      tokenMetadataPending.delete(mint);
    });
}

function normalizeTokenUri(uri) {
  if (!uri || typeof uri !== "string") {
    return null;
  }
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  }
  if (uri.includes("ipfs/") && uri.startsWith("https://")) {
    return uri;
  }
  return uri;
}

function generateFallbackAvatar(label) {
  const initials = (label || "?").trim().slice(0, 2).toUpperCase();
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="12" fill="#121520" />
      <text x="50%" y="50%" font-size="26" font-weight="600" fill="#00ff88" dy="0.35em" text-anchor="middle">${initials}</text>
    </svg>`;
  const encoded = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}

function formatPumpPrice(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  const formatted = value.toPrecision(3);
  return `$${formatted}`;
}

function formatPumpSol(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 1) {
    return `${value.toFixed(2)} SOL`;
  }
  return `${value.toFixed(3)} SOL`;
}

function formatPumpTokenAmount(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

function formatPumpTime(timestamp) {
  if (!timestamp) {
    return "—";
  }
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour12: false });
}

function runAutoTAForCandles(candles, token) {
  if (!candles || candles.length < 2) {
    return;
  }

  const analysisSidebar = document.getElementById("analysisSidebar");
  if (!analysisSidebar) {
    return;
  }

  analysisSidebar.style.display = "block";

  const recent = candles.slice(-30);
  const start = recent[0].open;
  const end = recent[recent.length - 1].close;
  const changePct = ((end - start) / start) * 100;
  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);
  const support = Math.min(...lows);
  const resistance = Math.max(...highs);
  const lastCandle = recent[recent.length - 1];

  let trend = "Sideways";
  let recommendation = "WAIT";
  let signalClass = "neutral";
  let confidence = 55;

  if (changePct > 6) {
    trend = "Uptrend";
    recommendation = "BUY NOW";
    signalClass = "bullish";
    confidence = 70;
  } else if (changePct < -6) {
    trend = "Downtrend";
    recommendation = "AVOID";
    signalClass = "bearish";
    confidence = 65;
  }

  const distanceToSupport = ((lastCandle.close - support) / support) * 100;
  const distanceToResistance = ((resistance - lastCandle.close) / resistance) * 100;

  let reasoning = `${trend} detected over the last ${recent.length} minutes.`;
  if (distanceToSupport < 5) {
    reasoning += " Price resting near support.";
  }
  if (distanceToResistance < 5) {
    reasoning += " Approaching resistance.";
    if (signalClass === "bullish") {
      recommendation = "WAIT";
      signalClass = "neutral";
    }
  }

  const patterns = [
    {
      name: trend,
      confidence: signalClass === "neutral" ? 5 : 7,
      signal: signalClass,
    },
  ];

  const analysis = {
    patterns,
    buybackRecommendation: recommendation,
    confidence,
    reasoning,
    currentSupport: formatPumpUsd(support),
    currentResistance: formatPumpUsd(resistance),
    marketState: trend,
    summary: `${token.symbol || token.name || token.mint.slice(0, 4)} market cap ${changePct >= 0 ? "rose" : "fell"} ${changePct.toFixed(2)}% over the observed window.`,
    raw: JSON.stringify({
      changePct,
      support,
      resistance,
      lastClose: lastCandle.close,
      distanceToSupport,
      distanceToResistance,
    }),
  };

  displayAnalysisResults(analysis);
}

function clearTechnicalOverlays() {
  taOverlayState.series.forEach((series) => {
    try {
      chart.removeSeries(series);
    } catch (err) {
      console.warn("Failed to remove overlay series", err.message);
    }
  });
  taOverlayState.priceLines.forEach((line) => {
    try {
      candlestickSeries.removePriceLine(line);
    } catch (err) {
      console.warn("Failed to remove price line", err.message);
    }
  });
  taOverlayState.series = [];
  taOverlayState.priceLines = [];
}

function applySyntheticOverlays(candles) {
  if (!candles || candles.length < 10) {
    return;
  }

  // 1) Moving average
  const period = Math.min(20, Math.floor(candles.length / 4));
  if (period >= 3) {
    const smaData = [];
    let sum = 0;
    for (let i = 0; i < candles.length; i += 1) {
      sum += candles[i].close;
      if (i >= period) {
        sum -= candles[i - period].close;
      }
      if (i >= period - 1) {
        smaData.push({ time: candles[i].time, value: sum / period });
      }
    }
    if (smaData.length) {
      const smaSeries = chart.addSeries(LineSeries, {
        color: "#ffaa00",
        lineWidth: 2,
        priceScaleId: "",
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      smaSeries.setData(smaData);
      taOverlayState.series.push(smaSeries);
    }
  }

  // 2) Pivot-based trendlines
  const pivots = findPivotPoints(candles, 2);
  if (pivots.highs.length >= 2) {
    const [h1, h2] = pivots.highs.slice(-2);
    createTrendOverlay(h1, h2, "#ff6666");
  }
  if (pivots.lows.length >= 2) {
    const [l1, l2] = pivots.lows.slice(-2);
    createTrendOverlay(l1, l2, "#00ff88");
  }

  // 3) Support/Resistance price lines
  if (pivots.lows.length) {
    const support = pivots.lows[pivots.lows.length - 1];
    const line = candlestickSeries.createPriceLine({
      price: support.value,
      color: "#00ff88",
      lineStyle: LineStyle.Dashed,
      title: "Support",
    });
    taOverlayState.priceLines.push(line);
  }
  if (pivots.highs.length) {
    const resistance = pivots.highs[pivots.highs.length - 1];
    const line = candlestickSeries.createPriceLine({
      price: resistance.value,
      color: "#ff6666",
      lineStyle: LineStyle.Dashed,
      title: "Resistance",
    });
    taOverlayState.priceLines.push(line);
  }
}

function findPivotPoints(candles, leftRight) {
  const highs = [];
  const lows = [];
  for (let i = leftRight; i < candles.length - leftRight; i += 1) {
    const candle = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= leftRight; j += 1) {
      if (candles[i - j].high >= candle.high || candles[i + j].high >= candle.high) {
        isHigh = false;
      }
      if (candles[i - j].low <= candle.low || candles[i + j].low <= candle.low) {
        isLow = false;
      }
      if (!isHigh && !isLow) {
        break;
      }
    }
    if (isHigh) {
      highs.push({ time: candle.time, value: candle.high });
    }
    if (isLow) {
      lows.push({ time: candle.time, value: candle.low });
    }
  }
  return { highs, lows };
}

function createTrendOverlay(pointA, pointB, color) {
  const series = chart.addSeries(LineSeries, {
    color,
    lineWidth: 1,
    priceScaleId: "",
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  series.setData([
    { time: pointA.time, value: pointA.value },
    { time: pointB.time, value: pointB.value },
  ]);
  taOverlayState.series.push(series);
}

function formatPumpUsd(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
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

function formatPumpChange(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPumpAge(timestamp) {
  if (!timestamp) {
    return "—";
  }
  const diff = Date.now() - timestamp;
  if (diff < 0) {
    return "0s";
  }
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function generateNewChart() {
  activePumpMint = null;
  activePumpRenderedMint = null;
  activePumpRenderedLastTime = 0;
  pumpChartAutoRange = true;
  renderPumpTokenTable();
  renderPumpTrades();
  if (pumpDom.metaPanel) {
    pumpDom.metaPanel.classList.remove("visible");
  }

  const options = {
    chartType: document.getElementById("chartType").value,
    scenario: "organic", // Always organic for pre-bonding
    volatility: document.getElementById("volatility").value,
  };

  // Generate new data
  currentData = generator.generate(options);

  // Update chart
  updateChart(currentData.data);
  clearTechnicalOverlays();
  applySyntheticOverlays(currentData.data);

  // Update info panel
  updateInfo(currentData);
}

function updateChart(data) {
  // Clear existing data
  candlestickSeries.setData([]);
  // volumeSeries.setData([]); // Removed

  // Clear existing price lines
  candlestickSeries.priceLines().forEach((line) => {
    candlestickSeries.removePriceLine(line);
  });

  // Set new data
  candlestickSeries.setData(data);

  // Volume data removed - too distracting
  // const volumeData = data.map((d) => ({
  //   time: d.time,
  //   value: d.volume,
  //   color:
  //     d.close >= d.open ? "rgba(0, 255, 136, 0.2)" : "rgba(255, 68, 68, 0.2)",
  // }));
  // volumeSeries.setData(volumeData);

  // Always show bonding line - 100k is the bonding curve ceiling
  // It's always relevant as the theoretical maximum for pre-bonding
  if (true) {
    candlestickSeries.createPriceLine({
      price: generator.BONDING_MCAP,
      color: "#ffff00",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "Bonding",
    });
  }

  // Fit content
  chart.timeScale().fitContent();
}

function updateInfo(chartData) {
  const { metadata, scenario, id } = chartData;

  document.getElementById("chartId").textContent = id.substr(0, 16) + "...";
  document.getElementById("scenarioInfo").textContent = "Pre-Bonding";

  // Format market cap values
  const formatMcap = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  document.getElementById("startMcap").textContent = formatMcap(
    metadata.startMcap
  );
  document.getElementById("peakMcap").textContent = formatMcap(
    metadata.peakMcap
  );
  document.getElementById("finalMcap").textContent = formatMcap(
    metadata.finalMcap
  );
  document.getElementById("totalCandles").textContent = metadata.totalCandles;
}

function exportData() {
  if (!currentData) return;

  const dataStr = JSON.stringify(currentData, null, 2);
  const dataUri =
    "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

  const exportFileDefaultName = `chart_${currentData.id}.json`;

  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", dataUri);
  linkElement.setAttribute("download", exportFileDefaultName);
  linkElement.click();
}

function exportImage() {
  const chartContainer = document.getElementById("chart");

  // Use html2canvas to capture the chart area
  html2canvas(chartContainer, {
    backgroundColor: "#131722", // Match chart background
    scale: 2, // Higher resolution
    useCORS: true,
    allowTaint: false,
  })
    .then((canvas) => {
      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const linkElement = document.createElement("a");
        linkElement.setAttribute("href", url);
        linkElement.setAttribute(
          "download",
          `chart_${currentData?.id || Date.now()}.png`
        );
        linkElement.click();

        // Clean up
        URL.revokeObjectURL(url);
      }, "image/png");
    })
    .catch((error) => {
      console.error("Error generating chart image:", error);
      alert("Error generating chart image. Please try again.");
    });
}

async function analyzeChart() {
  if (!currentData) {
    alert("Please generate a chart first before analyzing.");
    return;
  }

  const analyzeBtn = document.getElementById("analyzeBtn");
  const analysisSidebar = document.getElementById("analysisSidebar");
  
  // Show loading state
  analyzeBtn.textContent = "Analyzing...";
  analyzeBtn.disabled = true;
  
  // Show analysis sidebar
  analysisSidebar.style.display = "block";
  
  // Show loading in analysis sidebar
  document.getElementById("patternResults").innerHTML = '<div class="loading">Analyzing chart patterns...</div>';
  document.getElementById("buybackRecommendation").innerHTML = '<div class="loading">Generating buyback recommendation...</div>';
  document.getElementById("analysisDetails").innerHTML = '<div class="loading">Processing analysis details...</div>';

  try {
    // Capture chart as image
    const chartContainer = document.getElementById("chart");
    const canvas = await html2canvas(chartContainer, {
      backgroundColor: "#131722",
      scale: 2, // Higher resolution for better analysis
      useCORS: true,
      allowTaint: false,
    });

    // Convert canvas to blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/png");
    });

    // Debug: Log canvas info
    console.log('Chart captured:', {
      width: canvas.width,
      height: canvas.height,
      blobSize: blob.size
    });

    // Create form data for upload
    const formData = new FormData();
    formData.append("chart", blob, "chart.png");
    formData.append("chartId", currentData.id);
    formData.append("metadata", JSON.stringify({
      startMcap: currentData.metadata.startMcap,
      finalMcap: currentData.metadata.finalMcap,
      peakMcap: currentData.metadata.peakMcap,
      totalCandles: currentData.metadata.totalCandles
    }));

    // Send to analysis API
    const response = await fetch("/api/analyze-chart", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      displayAnalysisResults(result.analysis);
    } else {
      throw new Error(result.error || "Analysis failed");
    }

  } catch (error) {
    console.error("Chart analysis error:", error);
    
    // Show error in analysis sidebar
    document.getElementById("patternResults").innerHTML = `<div class="error">Analysis failed: ${error.message}</div>`;
    document.getElementById("buybackRecommendation").innerHTML = `<div class="error">Unable to generate recommendation</div>`;
    document.getElementById("analysisDetails").innerHTML = `<div class="error">Error details: ${error.message}</div>`;
  } finally {
    // Reset button state
    analyzeBtn.textContent = "Analyze with Claude";
    analyzeBtn.disabled = false;
  }
}

function displayAnalysisResults(analysis) {
  // Display overall confidence
  const confidence = calculateOverallConfidence(analysis);
  document.getElementById("overallConfidence").textContent = `${confidence}%`;

  // Display pattern results
  displayPatternResults(analysis.patterns || []);

  // Display buyback recommendation
  displayBuybackRecommendation(analysis);

  // Display analysis details
  displayAnalysisDetails(analysis);
}

function calculateOverallConfidence(analysis) {
  // Simple confidence calculation based on pattern strength
  const patterns = analysis.patterns || [];
  if (patterns.length === 0) return 50;
  
  const avgConfidence = patterns.reduce((sum, pattern) => {
    return sum + (pattern.confidence || 5);
  }, 0) / patterns.length;
  
  return Math.round(avgConfidence * 10);
}

function displayPatternResults(patterns) {
  const container = document.getElementById("patternResults");
  
  if (patterns.length === 0) {
    container.innerHTML = '<div class="loading">No patterns detected</div>';
    return;
  }

  const patternHTML = patterns.map(pattern => `
    <div class="pattern-item">
      <span class="pattern-name">${pattern.name || 'Unknown Pattern'}</span>
      <span class="pattern-confidence">${pattern.confidence || 5}/10</span>
      <span class="pattern-signal ${pattern.signal || 'neutral'}">${pattern.signal || 'NEUTRAL'}</span>
    </div>
  `).join('');

  container.innerHTML = patternHTML;
}

function displayBuybackRecommendation(analysis) {
  const container = document.getElementById("buybackRecommendation");
  
  // Use the analysis data directly
  const recommendation = analysis.buybackRecommendation || "WAIT";
  const confidence = analysis.confidence || 50;
  const reasoning = analysis.reasoning || "No reasoning provided";
  
  let signalClass = "wait-signal";
  if (recommendation === "BUY NOW") {
    signalClass = "buy-signal";
  } else if (recommendation === "AVOID") {
    signalClass = "sell-signal";
  }

  const recommendationHTML = `
    <div class="recommendation-header">
      <span class="recommendation-type">${recommendation}</span>
      <span class="recommendation-confidence">${confidence}%</span>
    </div>
    <div class="recommendation-reason">${reasoning}</div>
    <div class="recommendation-details">
      <div>Support Level: ${analysis.currentSupport || "Not identified"}</div>
      <div>Resistance Level: ${analysis.currentResistance || "Not identified"}</div>
      <div>Market State: ${analysis.marketState || "Unknown"}</div>
    </div>
  `;

  container.innerHTML = recommendationHTML;
  container.className = `recommendation-card ${signalClass}`;
}

function displayAnalysisDetails(analysis) {
  const container = document.getElementById("analysisDetails");
  
  const detailsHTML = `
    <div style="color: #d1d4dc; font-size: 13px; line-height: 1.6;">
      <div><strong>Analysis Summary:</strong></div>
      <div style="margin: 8px 0; color: #787b86;">${analysis.summary || 'No summary available'}</div>
      
      <div style="margin-top: 15px;"><strong>Current Market State:</strong></div>
      <div style="margin: 8px 0; color: #787b86;">${analysis.marketState || 'Unknown'}</div>
      
      <div style="margin-top: 15px;"><strong>Raw Analysis:</strong></div>
      <div style="margin: 8px 0; color: #787b86; font-size: 11px; max-height: 100px; overflow-y: auto;">
        ${(analysis.raw || '').substring(0, 500)}...
      </div>
    </div>
  `;

  container.innerHTML = detailsHTML;
}
