import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { supabaseService } from '../lib/supabase.js';

/**
 * 🏥 ENHANCED HEALTH CHECK
 * 
 * Like a doctor checking if you're healthy! This checks if all
 * parts of our system are working properly.
 */

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Only allow GET requests
  if (req.method && req.method.toUpperCase() !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  logger.apiRequest('GET', '/api/healthcheck');

  try {
    // 🔍 Basic system check
    const health = {
      status: '✅ ODIA MCP Server is Live',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      version: '1.0.0'
    };

    // 🏗️ Check if we can connect to database
    try {
      const { data, error } = await supabaseService
        .from('health_checks')
        .select('count')
        .limit(1);
      
      health.database = error ? '❌ Connection Failed' : '✅ Connected';
    } catch (dbError) {
      health.database = '⚠️ Check Failed';
      logger.warn('Database health check failed', { error: dbError.message });
    }

    // 📊 System metrics
    health.metrics = {
      responseTime: `${Date.now() - startTime}ms`,
      memory: process.memoryUsage(),
      uptime: `${Math.floor(process.uptime())}s`
    };

    // 🔧 Service status
    health.services = {
      claude: config.CLAUDE_API_KEY ? '✅ Configured' : '❌ Missing API Key',
      elevenlabs: config.ELEVENLABS_API_KEY ? '✅ Configured' : '⚠️ TTS Disabled',
      supabase: config.SUPABASE_URL ? '✅ Configured' : '❌ Missing Config',
      flutterwave: config.FLUTTERWAVE_SECRET_KEY ? '✅ Configured' : '⚠️ Payments Disabled'
    };

    logger.info('Health check completed', {
      responseTime: health.metrics.responseTime,
      database: health.database
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(health, null, 2));

  } catch (error) {
    logger.apiError('/api/healthcheck', error);
    
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: '❌ Server Error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }));
  }
}