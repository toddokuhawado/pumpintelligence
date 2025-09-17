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
  document
    .getElementById("analyzeBtn")
    .addEventListener("click", analyzeChart);
}

function generateNewChart() {
  const options = {
    chartType: document.getElementById("chartType").value,
    scenario: "organic", // Always organic for pre-bonding
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
