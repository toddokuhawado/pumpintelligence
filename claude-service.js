// Claude Code Integration Service
const EventEmitter = require('events');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs').promises;

const execPromise = util.promisify(exec);

class ClaudeCodeService extends EventEmitter {
  constructor() {
    super();
    
    // Security: Use environment variable, never hardcode
    this.sessionKey = process.env.CLAUDE_SESSION_KEY;
    this.isEnabled = !!this.sessionKey && this.sessionKey !== 'your_session_key_here';
    
    // Session management
    this.activeSessions = new Map();
    this.sessionHistory = new Map();
    this.publicClaudeDir = path.join(process.cwd(), 'public', 'claude');
    
    // Ensure claude directory exists
    this.initializeClaudeDirectory();
    
    console.log(`Claude Code Service: ${this.isEnabled ? 'Enabled' : 'Disabled'}`);
  }

  async initializeClaudeDirectory() {
    try {
      await fs.mkdir(this.publicClaudeDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create claude directory:', error.message);
    }
  }

  /**
   * Analyze a chart image using Claude Code
   * @param {string} imagePath - Path to the chart image
   * @param {string} customPrompt - Optional custom analysis prompt
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeChart(imagePath, customPrompt = null) {
    if (!this.isEnabled) {
      // Return mock analysis for testing when Claude is not configured
      console.log('Claude Code not configured, returning mock analysis for testing');
      return this.generateMockAnalysis();
    }

    const sessionId = this.generateSessionId();
    
    try {
      // Default analysis prompt focused on buyback timing
      const defaultPrompt = `Analyze this trading chart for buyback timing decisions. Focus on:
      1. Current chart patterns (double bottom, hammer, doji, triangle, wedge, flag, pennant, head & shoulders)
      2. Current support and resistance levels
      3. Recent price action and momentum
      4. Current market state (oversold, overbought, trending, consolidating)
      5. Buyback opportunity assessment (BUY NOW, WAIT, AVOID)
      
      IMPORTANT: The rightmost point on the chart shows the CURRENT price/market cap. 
      When recommending support levels, they should be BELOW the current price for a buyback opportunity.
      When recommending resistance levels, they should be ABOVE the current price.
      
      Provide specific pattern names with confidence scores (1-10) and clear buyback recommendations.`;

      const prompt = customPrompt || defaultPrompt;
      
      // Emit analysis start event
      this.emit('analysisStarted', { sessionId, imagePath });
      
      // Copy image to current directory for Claude to access
      const imageName = `chart_${Date.now()}.png`;
      const currentDirImage = path.join(process.cwd(), imageName);
      await fs.copyFile(imagePath, currentDirImage);
      
      // Verify the image file exists and is readable
      try {
        const stats = await fs.stat(currentDirImage);
        console.log(`Image file created: ${currentDirImage} (${stats.size} bytes)`);
      } catch (error) {
        console.error('Failed to verify image file:', error);
        throw new Error('Image file not accessible');
      }
      
      // Create a comprehensive prompt that includes the image reference
      const fullPrompt = `${prompt}

Please analyze the chart image: ${imageName}

CRITICAL: The rightmost point on the chart represents the CURRENT price/market cap. 
- Support levels should be BELOW the current price (for buying opportunities)
- Resistance levels should be ABOVE the current price (for selling opportunities)
- If the current price is at a support level, that's a potential BUY opportunity
- If the current price is at a resistance level, that's a potential SELL opportunity

Format your response as JSON with this structure:
{
  "patterns": [
    {"name": "Pattern Name", "confidence": 8, "signal": "bullish/bearish/neutral"}
  ],
  "currentSupport": "price level BELOW current price",
  "currentResistance": "price level ABOVE current price", 
  "marketState": "oversold/overbought/trending/consolidating",
  "buybackRecommendation": "BUY NOW/WAIT/AVOID",
  "confidence": 85,
  "reasoning": "Brief explanation focusing on current price position relative to support/resistance"
}

Only include patterns you can clearly identify. Use specific pattern names like "Double Bottom", "Hammer", "Ascending Triangle", etc.`;
      
      // Execute Claude Code CLI command using echo to pipe input
      const command = `echo "${fullPrompt.replace(/"/g, '\\"')}" | claude code --print`;
      console.log('Executing Claude Code analysis...');
      console.log('Command:', command.substring(0, 100) + '...');
      
      const { stdout, stderr } = await execPromise(command, {
        timeout: 60000, // 60 second timeout
        cwd: process.cwd(), // Run in current directory where image is located
        env: {
          ...process.env,
          CLAUDE_SESSION_KEY: this.sessionKey
        }
      });
      
      console.log('Claude output length:', stdout.length);
      console.log('Claude stderr:', stderr);
      
      // Clean up the copied image
      try {
        await fs.unlink(currentDirImage);
        console.log('Cleaned up image file');
      } catch (cleanupError) {
        console.warn('Failed to clean up copied image:', cleanupError.message);
      }

      if (stderr && !stderr.includes('Warning')) {
        console.warn('Claude Code stderr:', stderr);
      }

      const analysis = this.parseAnalysisOutput(stdout);
      const result = {
        sessionId,
        timestamp: new Date().toISOString(),
        imagePath,
        prompt,
        analysis,
        success: true
      };

      // Store in session history
      this.sessionHistory.set(sessionId, result);
      
      // Emit success event
      this.emit('analysisCompleted', result);
      
      return result;

    } catch (error) {
      const errorResult = {
        sessionId,
        timestamp: new Date().toISOString(),
        imagePath,
        error: error.message,
        success: false
      };

      this.emit('analysisError', errorResult);
      throw new Error(`Claude Code analysis failed: ${error.message}`);
    } finally {
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Parse Claude Code output into structured format
   * @param {string} output - Raw output from Claude Code
   * @returns {Object} Parsed analysis
   */
  parseAnalysisOutput(output) {
    try {
      // Try to extract JSON from the output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        
        return {
          raw: output,
          patterns: parsed.patterns || [],
          currentSupport: parsed.currentSupport || "Not identified",
          currentResistance: parsed.currentResistance || "Not identified",
          marketState: parsed.marketState || "Unknown",
          buybackRecommendation: parsed.buybackRecommendation || "WAIT",
          confidence: parsed.confidence || 50,
          reasoning: parsed.reasoning || "No reasoning provided",
          summary: parsed.reasoning || "Analysis completed"
        };
      }
    } catch (error) {
      console.warn('Failed to parse JSON from Claude output:', error.message);
    }
    
    // Fallback to text parsing if JSON fails
    const lines = output.split('\n').filter(line => line.trim());
    
    return {
      raw: output,
      patterns: this.extractPatternsFromText(lines),
      currentSupport: this.extractSupportLevel(lines),
      currentResistance: this.extractResistanceLevel(lines),
      marketState: this.extractMarketState(lines),
      buybackRecommendation: this.extractBuybackRecommendation(lines),
      confidence: this.extractConfidence(lines),
      reasoning: this.extractReasoning(lines),
      summary: this.extractSummary(lines)
    };
  }

  extractSummary(lines) {
    // Look for summary or overview sections
    const summaryKeywords = ['summary', 'overview', 'analysis', 'assessment'];
    return lines.find(line => 
      summaryKeywords.some(keyword => 
        line.toLowerCase().includes(keyword)
      )
    ) || lines[0] || 'No summary available';
  }

  extractPatternsFromText(lines) {
    // Extract specific patterns with confidence scores
    const patterns = [];
    const patternNames = [
      'double bottom', 'double top', 'head and shoulders', 'hammer', 'doji',
      'ascending triangle', 'descending triangle', 'symmetrical triangle',
      'rising wedge', 'falling wedge', 'flag', 'pennant', 'channel'
    ];
    
    lines.forEach(line => {
      patternNames.forEach(patternName => {
        if (line.toLowerCase().includes(patternName)) {
          // Try to extract confidence score
          const confidenceMatch = line.match(/(\d+)/);
          const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 5;
          
          // Determine signal type
          let signal = 'neutral';
          if (line.toLowerCase().includes('bullish') || line.toLowerCase().includes('buy')) {
            signal = 'bullish';
          } else if (line.toLowerCase().includes('bearish') || line.toLowerCase().includes('sell')) {
            signal = 'bearish';
          }
          
          patterns.push({
            name: patternName.charAt(0).toUpperCase() + patternName.slice(1),
            confidence: confidence,
            signal: signal
          });
        }
      });
    });
    
    return patterns.length > 0 ? patterns : [
      { name: 'No Clear Pattern', confidence: 3, signal: 'neutral' }
    ];
  }

  extractSupportLevel(lines) {
    const supportLine = lines.find(line => 
      line.toLowerCase().includes('support') && line.includes('$')
    );
    return supportLine || 'Not identified';
  }

  extractResistanceLevel(lines) {
    const resistanceLine = lines.find(line => 
      line.toLowerCase().includes('resistance') && line.includes('$')
    );
    return resistanceLine || 'Not identified';
  }

  extractMarketState(lines) {
    const stateKeywords = ['oversold', 'overbought', 'trending', 'consolidating'];
    const stateLine = lines.find(line => 
      stateKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );
    return stateLine || 'Unknown';
  }

  extractBuybackRecommendation(lines) {
    const buyKeywords = ['buy now', 'buy', 'purchase'];
    const waitKeywords = ['wait', 'hold', 'pause'];
    const avoidKeywords = ['avoid', 'sell', 'exit'];
    
    const text = lines.join(' ').toLowerCase();
    
    if (buyKeywords.some(keyword => text.includes(keyword))) {
      return 'BUY NOW';
    } else if (avoidKeywords.some(keyword => text.includes(keyword))) {
      return 'AVOID';
    } else {
      return 'WAIT';
    }
  }

  extractConfidence(lines) {
    const confidenceMatch = lines.join(' ').match(/(\d+)%/);
    return confidenceMatch ? parseInt(confidenceMatch[1]) : 50;
  }

  extractReasoning(lines) {
    const reasoningLine = lines.find(line => 
      line.toLowerCase().includes('reason') || 
      line.toLowerCase().includes('because') ||
      line.toLowerCase().includes('due to')
    );
    return reasoningLine || 'No reasoning provided';
  }

  /**
   * Get analysis history
   * @returns {Array} Array of past analyses
   */
  getAnalysisHistory() {
    return Array.from(this.sessionHistory.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `claude_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if Claude Code is properly configured
   * @returns {boolean} Configuration status
   */
  isConfigured() {
    return this.isEnabled;
  }

  /**
   * Test Claude Code connection
   * @returns {Promise<boolean>} Connection test result
   */
  async testConnection() {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const { stdout } = await execPromise('claude code "Hello, Claude!"', {
        timeout: 10000,
        env: {
          ...process.env,
          CLAUDE_SESSION_KEY: this.sessionKey
        }
      });
      return stdout.trim().length > 0;
    } catch (error) {
      console.error('Claude Code connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Generate mock analysis for testing when Claude is not configured
   * @returns {Object} Mock analysis result
   */
  generateMockAnalysis() {
    const sessionId = this.generateSessionId();
    
    // Generate random patterns for demonstration
    const patterns = [
      { name: 'Double Bottom', confidence: 8, signal: 'bullish' },
      { name: 'Hammer', confidence: 7, signal: 'bullish' },
      { name: 'Ascending Triangle', confidence: 6, signal: 'bullish' }
    ];

    const mockAnalysis = {
      sessionId,
      timestamp: new Date().toISOString(),
      imagePath: 'mock-image.png',
      prompt: 'Mock analysis for testing',
      analysis: {
        raw: 'Mock analysis: Chart shows strong bullish patterns with double bottom formation and hammer reversal at key support level. Volume is increasing on upward moves, indicating potential breakout.',
        summary: 'Strong bullish reversal patterns detected with high confidence. Double bottom formation suggests potential upward movement.',
        patterns: patterns,
        phases: [
          'Early accumulation phase with gradual price buildup',
          'Consolidation period showing healthy sideways movement',
          'Breakout attempt with increasing volume'
        ],
        technicalLevels: [
          'Support at $45,200 - strong level with multiple tests',
          'Resistance at $52,800 - previous high that needs to be broken',
          'Key level at $48,500 - 50% retracement level'
        ]
      },
      success: true
    };

    // Store in session history
    this.sessionHistory.set(sessionId, mockAnalysis);
    
    return mockAnalysis;
  }
}

module.exports = ClaudeCodeService;