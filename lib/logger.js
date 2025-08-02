import winston from 'winston';

/**
 * 🚨 SMART ALARM SYSTEM
 * 
 * This is like having a security guard who writes down everything
 * that happens in a special logbook. If something goes wrong,
 * we can look at the logbook to understand what happened!
 */

const { NODE_ENV, LOG_LEVEL } = process.env;

// Create different types of alarm bells 🔔
const logger = winston.createLogger({
  level: LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const emoji = {
        error: '🚨',
        warn: '⚠️',
        info: 'ℹ️',
        debug: '🔍'
      }[level] || 'ℹ️';
      
      return `${emoji} [${timestamp}] ${level.toUpperCase()}: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`;
    })
  ),
  transports: [
    new winston.transports.Console({
      silent: NODE_ENV === 'test'
    })
  ]
});

// Special helper functions for common situations
logger.apiRequest = (method, endpoint, userId = 'anonymous') => {
  logger.info(`📞 API Request: ${method} ${endpoint}`, {
    method,
    endpoint,
    userId,
    timestamp: new Date().toISOString()
  });
};

logger.apiError = (endpoint, error, userId = 'anonymous') => {
  logger.error(`💥 API Error: ${endpoint}`, {
    endpoint,
    error: error.message,
    userId,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
};

logger.securityEvent = (event, details = {}) => {
  logger.warn(`🔒 Security Event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

export { logger };