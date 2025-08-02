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

    // 🏗️ Enhanced database connectivity check
    try {
      // Try to query the health_checks table
      const { data, error } = await supabaseService
        .from('health_checks')
        .select('id')
        .limit(1);
      
      if (error) {
        // If health_checks table doesn't exist, try to create it and test basic connectivity
        try {
          const { data: createData, error: createError } = await supabaseService
            .from('health_checks')
            .insert({ status: 'auto_created', timestamp: new Date().toISOString() })
            .select();
          
          if (createError) {
            // Fall back to basic connectivity test
            const { data: basicTest, error: basicError } = await supabaseService
              .rpc('version');
            
            health.database = basicError ? '❌ Connection Failed' : '⚠️ Tables Missing';
          } else {
            health.database = '✅ Connected & Ready';
          }
        } catch (fallbackError) {
          health.database = '⚠️ Partial Connection';
        }
      } else {
        health.database = '✅ Connected';
      }
    } catch (dbError) {
      health.database = '❌ Connection Failed';
      logger.warn('Database health check failed', { error: dbError.message });
    }

    // 📊 System metrics
    health.metrics = {
      responseTime: `${Date.now() - startTime}ms`,
      memory: {
        used: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heap: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      },
      uptime: `${Math.floor(process.uptime())}s`
    };

    // 🔧 Service status with proper environment variable checks
    health.services = {
      claude: config.CLAUDE_API_KEY ? '✅ Configured' : '❌ Missing API Key',
      elevenlabs: config.ELEVENLABS_API_KEY ? '✅ Configured' : '⚠️ TTS Disabled',
      supabase: (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) ? '✅ Configured' : '❌ Missing Config',
      flutterwave: config.FLUTTERWAVE_SECRET_KEY ? '✅ Configured' : '⚠️ Payments Disabled'
    };

    // 🎯 Overall system health calculation
    const criticalServices = ['claude', 'supabase'];
    const criticalServicesHealthy = criticalServices.every(service => 
      health.services[service].includes('✅')
    );
    
    const dbHealthy = health.database.includes('✅') || health.database.includes('⚠️');
    
    if (criticalServicesHealthy && dbHealthy) {
      health.overall = '🟢 All Systems Operational';
    } else if (criticalServicesHealthy) {
      health.overall = '🟡 Minor Issues - Core Functions Working';
    } else {
      health.overall = '🔴 Critical Issues Detected';
    }

    logger.info('Health check completed', {
      responseTime: health.metrics.responseTime,
      database: health.database,
      overall: health.overall
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
      timestamp: new Date().toISOString(),
      overall: '🔴 System Error'
    }));
  }
}
