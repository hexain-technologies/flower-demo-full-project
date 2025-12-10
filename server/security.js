const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const validator = require('validator');

const CSRF_TOKEN_FIELD = 'x-csrf-token';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user !== undefined
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const csrfProtection = csrf({ cookie: false });

const sanitizeInput = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === 'string') {
      sanitized[key] = validator.trim(validator.escape(val));
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      sanitized[key] = val;
    } else if (Array.isArray(val)) {
      sanitized[key] = val.map(v => typeof v === 'string' ? validator.escape(v) : v);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};

const sanitizeData = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Potential NoSQL injection attempt in ${key}`);
  }
});

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
});

const safeErrorHandler = (err, statusCode = 500, message = 'Internal Server Error') => {
  console.error('Error:', err);
  const isDev = process.env.NODE_ENV === 'development';
  return {
    error: message,
    ...(isDev && { details: err.message })
  };
};

module.exports = {
  loginLimiter,
  apiLimiter,
  csrfProtection,
  sanitizeInput,
  sanitizeData,
  securityHeaders,
  safeErrorHandler,
  CSRF_TOKEN_FIELD
};
