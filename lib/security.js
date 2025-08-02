import { logger } from './logger.js';

/**
 * 🛡️ SECURITY GUARDS SYSTEM
 * 
 * Think of these as bouncers at a club - they check if people
 * are allowed in and make sure everyone behaves properly!
 */

// 🚫 Rate Limiter - Stops people from spamming
const requestCounts = new Map();

export function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const clientIP = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old requests
    if (requestCounts.has(clientIP)) {
      const requests = requestCounts.get(clientIP).filter(time => time > windowStart);
      requestCounts.set(clientIP, requests);
    } else {
      requestCounts.set(clientIP, []);
    }
    
    const requests = requestCounts.get(clientIP);
    
    if (requests.length >= maxRequests) {
      logger.securityEvent('Rate limit exceeded', { 
        clientIP, 
        requestCount: requests.length,
        endpoint: req.url 
      });
      
      res.status(429).json({
        error: 'Too many requests. Please slow down! 🐌',
        retryAfter: Math.ceil(windowMs / 1000)
      });
      return;
    }
    
    requests.push(now);
    next?.();
  };
}

// 🧹 Input Cleaner - Makes sure inputs are safe
export function validateInput(schema) {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body);
      
      if (error) {
        logger.securityEvent('Invalid input detected', {
          endpoint: req.url,
          error: error.details[0].message
        });
        
        res.status(400).json({
          error: 'Invalid input format 📝',
          details: error.details[0].message
        });
        return;
      }
      
      req.body = value; // Use cleaned/validated data
      next?.();
    } catch (err) {
      logger.apiError(req.url, err);
      res.status(500).json({ error: 'Validation error' });
    }
  };
}

// 🔒 Safe Error Handler - Doesn't reveal secrets
export function handleError(error, req, res) {
  const requestId = req.headers['x-request-id'] || Date.now().toString();
  
  logger.apiError(req.url, error, requestId);
  
  // Different responses for different environments
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (error.statusCode && error.statusCode < 500) {
    // Client errors (400-499) - safe to show
    res.status(error.statusCode).json({
      error: error.message,
      requestId
    });
  } else {
    // Server errors (500+) - hide details in production
    res.status(500).json({
      error: isDevelopment ? error.message : 'Something went wrong on our end 🔧',
      requestId,
      ...(isDevelopment && { stack: error.stack })
    });
  }
}

// 🛡️ Security Headers - Adds protective shields
export function addSecurityHeaders(req, res, next) {
  // Prevent websites from embedding our API in frames
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next?.();
}