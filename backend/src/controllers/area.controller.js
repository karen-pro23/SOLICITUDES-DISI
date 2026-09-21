const areaService = require('../services/area.service');

async function getByDepartment(req, res, next) {
  try {
    const departmentId = parseInt(req.params.departmentId, 10);
    const areas = await areaService.getByDepartment(departmentId);
    res.json({ areas });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const areaId = parseInt(req.params.areaId, 10);
    const area = await areaService.getById(areaId);
    if (!area) return res.status(404).json({ error: 'Área no encontrada' });
    res.json({ area });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { departmentId, name, description } = req.body;
    if (!departmentId || !name) {
      return res.status(400).json({ error: 'Departamento y nombre son obligatorios' });
    }
    const area = await areaService.create(parseInt(departmentId, 10), name, description);
    res.status(201).json({ area });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const areaId = parseInt(req.params.areaId, 10);
    const { name, description, isActive } = req.body;
    const area = await areaService.update(areaId, name, description, isActive);
    if (!area) return res.status(404).json({ error: 'Área no encontrada' });
    res.json({ area });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const areaId = parseInt(req.params.areaId, 10);
    await areaService.remove(areaId);
    res.json({ message: 'Área eliminada' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function getAreasByUser(req, res, next) {
  try {
    const userId = req.user.userId;
    const areas = await areaService.getAreasByUser(userId);
    res.json({ areas });
  } catch (err) { next(err); }
}

module.exports = { getByDepartment, getById, create, update, remove, getAreasByUser };
