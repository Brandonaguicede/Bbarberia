const { pool } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM barbers WHERE active = 1 ORDER BY name ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllIncludingInactive = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM barbers ORDER BY name ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM barbers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Barbero no encontrado' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, specialty, phone, email } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO barbers (id, name, specialty, phone, email) VALUES (?, ?, ?, ?, ?)',
      [id, name, specialty || null, phone || null, email || null]
    );
    const [rows] = await pool.query('SELECT * FROM barbers WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { name, specialty, phone, email, active } = req.body;
    const { id } = req.params;
    const [existing] = await pool.query('SELECT id FROM barbers WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Barbero no encontrado' });
    await pool.query(
      'UPDATE barbers SET name = ?, specialty = ?, phone = ?, email = ?, active = ? WHERE id = ?',
      [name, specialty || null, phone || null, email || null, active !== undefined ? active : 1, id]
    );
    const [rows] = await pool.query('SELECT * FROM barbers WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    // Check for future appointments
    const [appts] = await pool.query(
      "SELECT id FROM appointments WHERE barber_id = ? AND appointment_date >= CURDATE() AND status != 'cancelled'",
      [id]
    );
    if (appts.length > 0) {
      return res.status(409).json({
        success: false,
        message: `No se puede eliminar. Tiene ${appts.length} cita(s) pendientes.`
      });
    }
    await pool.query('UPDATE barbers SET active = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Barbero desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getAllIncludingInactive, getById, create, update, remove };
