const { pool } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });

    const [rows] = await pool.query(
      `SELECT u.*, b.name as barber_name 
       FROM users u 
       LEFT JOIN barbers b ON u.barber_id = b.id 
       WHERE u.username = ? AND u.active = 1`,
      [username]
    );

    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });

    // Store session (never store the password hash)
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      barber_id: user.barber_id,
      barber_name: user.barber_name || null,
    };

    res.json({
      success: true,
      data: req.session.user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Sesión cerrada' });
  });
};

// GET /api/auth/me
const me = (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).json({ success: false, message: 'No autenticado' });
  res.json({ success: true, data: req.session.user });
};

// ── User management (admin only) ──────────────────────────────────────────────

// GET /api/auth/users
const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.role, u.active, u.barber_id, u.created_at,
              b.name as barber_name
       FROM users u
       LEFT JOIN barbers b ON u.barber_id = b.id
       ORDER BY u.role DESC, u.username ASC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/users
const createUser = async (req, res) => {
  try {
    const { username, password, role, barber_id } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });

    // Check username unique
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Ese nombre de usuario ya existe' });

    const hashed = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await pool.query(
      'INSERT INTO users (id, username, password, role, barber_id) VALUES (?, ?, ?, ?, ?)',
      [id, username, hashed, role || 'barber', barber_id || null]
    );

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.role, u.active, u.barber_id, b.name as barber_name
       FROM users u LEFT JOIN barbers b ON u.barber_id = b.id WHERE u.id = ?`,
      [id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/auth/users/:id
const updateUser = async (req, res) => {
  try {
    const { username, password, role, barber_id, active } = req.body;
    const { id } = req.params;

    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // Check username conflict with another user
    if (username) {
      const [dup] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
      if (dup.length > 0)
        return res.status(409).json({ success: false, message: 'Ese nombre de usuario ya existe' });
    }

    let passwordClause = '';
    const params = [];

    if (password && password.trim() !== '') {
      const hashed = await bcrypt.hash(password, 10);
      passwordClause = ', password = ?';
      params.push(hashed);
    }

    await pool.query(
      `UPDATE users SET username = ?, role = ?, barber_id = ?, active = ?${passwordClause} WHERE id = ?`,
      [username, role || 'barber', barber_id || null, active !== undefined ? active : 1, ...params, id]
    );

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.role, u.active, u.barber_id, b.name as barber_name
       FROM users u LEFT JOIN barbers b ON u.barber_id = b.id WHERE u.id = ?`,
      [id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/auth/users/:id
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent deleting yourself
    if (req.session.user.id === id)
      return res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario' });

    await pool.query('UPDATE users SET active = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuario desactivado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, logout, me, getUsers, createUser, updateUser, deleteUser };
