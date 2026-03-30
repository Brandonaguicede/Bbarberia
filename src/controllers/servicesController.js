const { pool } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM services WHERE active = 1 ORDER BY category, name ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllIncludingInactive = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM services ORDER BY category, name ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, description, duration, price, category } = req.body;
    if (!name || !duration || !price)
      return res.status(400).json({ success: false, message: 'Nombre, duración y precio son requeridos' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO services (id, name, description, duration, price, category) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, description || null, duration, price, category || 'general']
    );
    const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { name, description, duration, price, category, active } = req.body;
    const { id } = req.params;
    const [existing] = await pool.query('SELECT id FROM services WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    await pool.query(
      'UPDATE services SET name = ?, description = ?, duration = ?, price = ?, category = ?, active = ? WHERE id = ?',
      [name, description || null, duration, price, category || 'general', active !== undefined ? active : 1, id]
    );
    const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE services SET active = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Servicio desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getAllIncludingInactive, getById, create, update, remove };
