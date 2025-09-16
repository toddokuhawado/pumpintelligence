// Import series types from lightweight-charts
const {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
} = LightweightCharts;

// Initialize the app
let chart = null;
let candlestickSeries = null;
let volumeSeries = null;
let currentData = null;
let generator = null;

// Initialize chart when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  generator = new ChartGenerator();
  initChart();
  setupEventListeners();
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
}

function setupEventListeners() {
  document
    .getElementById("generateBtn")
    .addEventListener("click", generateNewChart);
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document
    .getElementById("exportImageBtn")
    .addEventListener("click", exportImage);
}

function generateNewChart() {
  const options = {
    chartType: document.getElementById("chartType").value,
    scenario: document.getElementById("scenario").value,
    volatility: document.getElementById("volatility").value,
  };

  // Generate new data
  currentData = generator.generate(options);

  // Update chart
  updateChart(currentData.data);

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
  document.getElementById("scenarioInfo").textContent = scenario;

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
