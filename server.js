// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const ClaudeCodeService = require('./claude-service');

const app = express();
const port = process.env.PORT || 8000;

// Initialize Claude Code service
const claudeService = new ClaudeCodeService();

// Configure multer for file uploads
const upload = multer({
  dest: 'tmp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Serve static files
app.use(express.static('.'));
app.use(express.json());

// API endpoint for chart analysis
app.post('/api/analyze-chart', upload.single('chart'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No chart image provided'
      });
    }

    // Note: Claude Code service will return mock data if not configured

    const imagePath = req.file.path;
    const chartId = req.body.chartId;
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

    console.log(`Analyzing chart ${chartId} with Claude Code...`);

    // Analyze the chart with Claude Code
    const result = await claudeService.analyzeChart(imagePath);

    // Clean up uploaded file
    try {
      await fs.unlink(imagePath);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded file:', cleanupError.message);
    }

    // Return analysis results
    res.json({
      success: true,
      chartId,
      analysis: result.analysis,
      timestamp: result.timestamp,
      sessionId: result.sessionId
    });

  } catch (error) {
    console.error('Chart analysis error:', error);
    
    // Clean up uploaded file in case of error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file after error:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Analysis failed'
    });
  }
});

// API endpoint to get analysis history
app.get('/api/analysis-history', (req, res) => {
  try {
    const history = claudeService.getAnalysisHistory();
    res.json({
      success: true,
      history: history.slice(0, 10) // Return last 10 analyses
    });
  } catch (error) {
    console.error('Error getting analysis history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analysis history'
    });
  }
});

// API endpoint to test Claude Code connection
app.get('/api/claude-status', async (req, res) => {
  try {
    const isConfigured = claudeService.isConfigured();
    let connectionTest = false;

    if (isConfigured) {
      connectionTest = await claudeService.testConnection();
    }

    res.json({
      configured: isConfigured,
      connected: connectionTest,
      status: isConfigured 
        ? (connectionTest ? 'ready' : 'configured_but_disconnected')
        : 'not_configured'
    });
  } catch (error) {
    console.error('Error testing Claude Code status:', error);
    res.json({
      configured: false,
      connected: false,
      status: 'error',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Chart Generator Server running on http://localhost:${port}`);
  console.log(`📊 Claude Code Integration: ${claudeService.isConfigured() ? '✅ Enabled' : '❌ Disabled'}`);
  
  if (!claudeService.isConfigured()) {
    console.log('💡 To enable Claude Code analysis:');
    console.log('   1. Set CLAUDE_SESSION_KEY environment variable');
    console.log('   2. Restart the server');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

module.exports = app;