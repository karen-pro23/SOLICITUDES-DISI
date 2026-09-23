const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const result = await authService.login(username, password);

    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.json({
      user: result.user,
      refreshToken: result.refreshToken.token,
      accessToken: result.accessToken,
    });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requerido' });
    }

    const result = await authService.refresh(refreshToken);

    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.json({ 
      refreshToken: result.refreshToken.token,
      accessToken: result.accessToken,
    });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.clearCookie('token');
    res.json({ message: 'Sesión cerrada' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Regenerar token cookie con el rol actual de la BD
    const freshToken = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        departmentId: user.department_id,
        es_jefe: user.es_jefe,
        is_jefe_departamento: user.is_jefe_departamento || false,
        areaId: user.area_id || null,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.cookie('token', freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, me };
