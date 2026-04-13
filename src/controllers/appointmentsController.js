const { pool } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const { sendNewAppointmentEmail, sendCancellationEmail } = require('../services/emailService');

// Helper: convert HH:MM[:SS] to minutes integer
const toMinutes = (timeStr) => {
  const parts = String(timeStr).split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

const getAll = async (req, res) => {
  try {
    const { date, barber_id, status, from, to } = req.query;
    const sessionUser = req.session.user;

    let query = `
      SELECT 
        a.*,
        b.name as barber_name,
        s.name as service_name,
        CAST(s.duration AS UNSIGNED) as service_duration,
        s.price as service_price
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      JOIN services s ON a.service_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (sessionUser.role === 'barber') {
      query += ' AND a.barber_id = ?';
      params.push(sessionUser.barber_id);
    } else {
      if (barber_id) { query += ' AND a.barber_id = ?'; params.push(barber_id); }
    }

    if (date)   { query += ' AND a.appointment_date = ?';  params.push(date); }
    if (status) { query += ' AND a.status = ?';            params.push(status); }
    if (from)   { query += ' AND a.appointment_date >= ?'; params.push(from); }
    if (to)     { query += ' AND a.appointment_date <= ?'; params.push(to); }

    query += ' ORDER BY a.appointment_date ASC, a.appointment_time ASC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, b.name as barber_name, s.name as service_name,
             CAST(s.duration AS UNSIGNED) as service_duration, s.price
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      JOIN services s ON a.service_id = s.id
      WHERE a.id = ?
    `, [req.params.id]);
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });

    const appt = rows[0];
    if (req.session.user.role === 'barber' && appt.barber_id !== req.session.user.barber_id)
      return res.status(403).json({ success: false, message: 'Acceso denegado' });

    res.json({ success: true, data: appt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAvailableSlots = async (req, res) => {
  try {
    const { barber_id, date, service_id } = req.query;
    if (!barber_id || !date)
      return res.status(400).json({ success: false, message: 'barber_id y date son requeridos' });

    let duration = 45;
    if (service_id) {
      const [svc] = await pool.query('SELECT CAST(duration AS UNSIGNED) as duration FROM services WHERE id = ?', [service_id]);
      if (svc.length > 0) duration = Number(svc[0].duration);
    }

    const [booked] = await pool.query(
      `SELECT a.appointment_time, CAST(s.duration AS UNSIGNED) as duration
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.barber_id = ? AND a.appointment_date = ? AND a.status != 'cancelled'`,
      [barber_id, date]
    );

    // Generate slots every 45 min from 9:00 to 19:00
    const workStart = 9 * 60;
    const workEnd   = 19 * 60;
    const slotSize  = 45; // citas cada 45 minutos
    const allSlots  = [];

    for (let m = workStart; m + duration <= workEnd; m += slotSize) {
      const h   = Math.floor(m / 60).toString().padStart(2, '0');
      const min = (m % 60).toString().padStart(2, '0');
      allSlots.push(`${h}:${min}`);
    }

    const available = allSlots.filter(slot => {
      const slotStart = toMinutes(slot);
      for (const b of booked) {
        const bStart    = toMinutes(b.appointment_time);
        const bDuration = Number(b.duration);
        if (slotStart < bStart + bDuration && slotStart + duration > bStart) return false;
      }
      return true;
    });

    res.json({ success: true, data: available });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const {
      client_name, client_phone, client_email,
      barber_id, service_id,
      appointment_date, appointment_time, notes,
    } = req.body;

    if (!client_name || !client_phone || !barber_id || !service_id || !appointment_date || !appointment_time)
      return res.status(400).json({ success: false, message: 'Todos los campos obligatorios deben completarse' });

    const [svc] = await pool.query('SELECT CAST(duration AS UNSIGNED) as duration FROM services WHERE id = ?', [service_id]);
    const duration = Number(svc[0]?.duration || 45);

    const [allBooked] = await pool.query(
      `SELECT a.appointment_time, CAST(s.duration AS UNSIGNED) as duration
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.barber_id = ? AND a.appointment_date = ? AND a.status != 'cancelled'`,
      [barber_id, appointment_date]
    );

    const newStart = toMinutes(appointment_time);
    for (const b of allBooked) {
      const bStart    = toMinutes(b.appointment_time);
      const bDuration = Number(b.duration);
      if (newStart < bStart + bDuration && newStart + duration > bStart)
        return res.status(409).json({ success: false, message: 'El horario seleccionado no está disponible' });
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO appointments
       (id, client_name, client_phone, client_email, barber_id, service_id,
        appointment_date, appointment_time, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, client_name, client_phone, client_email || null,
       barber_id, service_id, appointment_date, appointment_time, notes || null]
    );

    const [rows] = await pool.query(`
      SELECT a.*, b.name as barber_name, b.email as barber_email,
             s.name as service_name,
             CAST(s.duration AS UNSIGNED) as service_duration, s.price as service_price
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      JOIN services s ON a.service_id = s.id
      WHERE a.id = ?
    `, [id]);

    const newAppt = rows[0];

    // Fire-and-forget email — never blocks the response
    sendNewAppointmentEmail(newAppt, newAppt.barber_email);

    // Remove barber_email from response (not needed by frontend)
    delete newAppt.barber_email;
    res.status(201).json({ success: true, data: newAppt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const {
      client_name, client_phone, client_email,
      barber_id, service_id,
      appointment_date, appointment_time, status, notes,
    } = req.body;
    const { id } = req.params;

    const [existing] = await pool.query('SELECT id FROM appointments WHERE id = ?', [id]);
    if (existing.length === 0)
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });

    await pool.query(
      `UPDATE appointments
       SET client_name=?, client_phone=?, client_email=?,
           barber_id=?, service_id=?,
           appointment_date=?, appointment_time=?, status=?, notes=?
       WHERE id=?`,
      [client_name, client_phone, client_email || null,
       barber_id, service_id,
       appointment_date, appointment_time, status, notes || null, id]
    );

    const [rows] = await pool.query(`
      SELECT a.*, b.name as barber_name, s.name as service_name,
             CAST(s.duration AS UNSIGNED) as service_duration, s.price as service_price
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      JOIN services s ON a.service_id = s.id
      WHERE a.id = ?
    `, [id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Estado inválido' });

    // If cancelling, fetch appt for email notification
    if (status === 'cancelled') {
      const [rows] = await pool.query(`
        SELECT a.*, b.email as barber_email, b.name as barber_name,
               s.name as service_name, s.price as service_price,
               CAST(s.duration AS UNSIGNED) as service_duration
        FROM appointments a
        JOIN barbers b ON a.barber_id = b.id
        JOIN services s ON a.service_id = s.id
        WHERE a.id = ?
      `, [req.params.id]);
      if (rows.length > 0) sendCancellationEmail(rows[0], rows[0].barber_email);
    }

    await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Estado actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    // Fetch for cancellation email
    const [rows] = await pool.query(`
      SELECT a.*, b.email as barber_email, b.name as barber_name,
             s.name as service_name, s.price as service_price,
             CAST(s.duration AS UNSIGNED) as service_duration
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      JOIN services s ON a.service_id = s.id
      WHERE a.id = ?
    `, [req.params.id]);
    if (rows.length > 0) sendCancellationEmail(rows[0], rows[0].barber_email);

    await pool.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Cita cancelada correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const [total]   = await pool.query("SELECT COUNT(*) as count FROM appointments WHERE appointment_date >= CURDATE()");
    const [today]   = await pool.query("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURDATE() AND status != 'cancelled'");
    const [pending] = await pool.query("SELECT COUNT(*) as count FROM appointments WHERE status = 'pending' AND appointment_date >= CURDATE()");
    const [revenue] = await pool.query("SELECT SUM(s.price) as total FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.status = 'completed' AND MONTH(a.appointment_date) = MONTH(CURDATE())");
    res.json({
      success: true,
      data: {
        upcoming:       total[0].count,
        today:          today[0].count,
        pending:        pending[0].count,
        monthlyRevenue: revenue[0].total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getById, getAvailableSlots, create, update, updateStatus, remove, getStats };
