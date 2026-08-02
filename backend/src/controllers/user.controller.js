const userService = require('../services/user.service');

async function getAll(req, res, next) {
  try {
    const users = await userService.findAll();
    res.json({ users });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const user = await userService.findById(parseInt(req.params.id, 10));
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { fullName, email, password, role, departmentId } = req.body;
    if (!fullName || !email || !password || !role || !departmentId) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    const user = await userService.create(req.body);
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya existe' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const user = await userService.update(parseInt(req.params.id, 10), req.body);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await userService.remove(parseInt(req.params.id, 10));
    res.json({ message: 'Usuario eliminado' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove };
