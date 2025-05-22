const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Configure the Winston logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'clipt-api' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...meta }) => {
            return `${timestamp} ${level}: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`;
          }
        )
      ),
    }),
  ],
  // Don't exit on uncaught exceptions
  exitOnError: false,
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || 'logs';
  const errorLogPath = path.join(logDir, 'error.log');
  const combinedLogPath = path.join(logDir, 'combined.log');
  
  logger.add(new winston.transports.File({
    filename: errorLogPath,
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }));
  
  logger.add(new winston.transports.File({
    filename: combinedLogPath,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  }));
}

module.exports = logger;
