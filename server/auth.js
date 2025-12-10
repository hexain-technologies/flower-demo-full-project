const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { AuditLog } = require('./models');

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables are required. Set them in .env file.');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const TOKEN_EXPIRY = '24h';
const REFRESH_EXPIRY = '7d';

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user.id, username: user.username },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (e) {
    return null;
  }
};

const getClientIp = (req) => {
  return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
};

const logAudit = async (userId, action, resource, resourceId, changes = null, status = 'SUCCESS', errorMessage = null, ipAddress = 'unknown') => {
  try {
    await AuditLog.create({
      id: uuidv4(),
      userId,
      action,
      resource,
      resourceId,
      changes,
      ipAddress,
      status,
      errorMessage
    });
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
};

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireAdminOrSelf = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Allow if admin or if accessing own user
  if (req.user.role === 'ADMIN' || req.user.id === req.params.id) {
    return next();
  }
  return res.status(403).json({ error: 'Unauthorized access' });
};

module.exports = {
  hashPassword,
  comparePassword,
  generateTokens,
  verifyToken,
  verifyRefreshToken,
  getClientIp,
  logAudit,
  authMiddleware,
  requireAdmin,
  requireAdminOrSelf,
  JWT_SECRET
};
