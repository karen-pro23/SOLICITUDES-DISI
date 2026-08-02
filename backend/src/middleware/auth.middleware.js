const jwt = require('jsonwebtoken');
const config = require('../config/env');

function authenticate(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Se requiere autenticación' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      departmentId: decoded.departmentId,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

function requireDepartmentAccess(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.params.id || req.body.departmentId) {
    const targetDept = parseInt(req.params.departmentId || req.body.departmentId, 10);
    if (targetDept && targetDept !== req.user.departmentId) {
      return res.status(403).json({ error: 'No tienes acceso a este departamento' });
    }
  }
  next();
}

module.exports = { authenticate, requireRole, requireDepartmentAccess };
