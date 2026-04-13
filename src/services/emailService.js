const nodemailer = require('nodemailer');

// Create transporter — uses env vars so the owner can plug in any provider
function createTransporter() {
  // Support Gmail, Outlook, or custom SMTP
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password (not your regular password)
      },
    });
  }

  // Generic SMTP (for Outlook, Yahoo, custom hosting, etc.)
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ── Templates ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatPrice(p) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(p);
}

// HTML email for barber — new appointment notification
function barberNewAppointmentHtml(appt) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#0a0a0a; color:#f0ece4; margin:0; padding:0; }
  .wrap { max-width:520px; margin:0 auto; padding:32px 16px; }
  .card { background:#111; border:1px solid #2a2a2a; border-radius:14px; overflow:hidden; }
  .header { background:linear-gradient(135deg,#8a6f2e,#c9a84c); padding:24px 28px; text-align:center; }
  .header h1 { margin:0; font-size:22px; color:#0a0a0a; font-weight:800; }
  .header p  { margin:6px 0 0; font-size:13px; color:#0a0a0a; opacity:0.7; }
  .body { padding:24px 28px; }
  .row { display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid #1e1e1e; font-size:14px; }
  .row:last-child { border-bottom:none; }
  .label { color:#888; }
  .value { color:#f0ece4; font-weight:600; text-align:right; }
  .highlight { color:#c9a84c !important; }
  .footer { padding:16px 28px; text-align:center; font-size:11px; color:#555; border-top:1px solid #1e1e1e; }
</style></head>
<body>
<div class="wrap">
  <div class="card">
    <div class="header">
      <h1>✂ Nueva Cita Agendada</h1>
      <p>Angel Barber Shop</p>
    </div>
    <div class="body">
      <div class="row"><span class="label">Cliente</span><span class="value">${appt.client_name}</span></div>
      <div class="row"><span class="label">Teléfono</span><span class="value">${appt.client_phone}</span></div>
      ${appt.client_email ? `<div class="row"><span class="label">Correo</span><span class="value">${appt.client_email}</span></div>` : ''}
      <div class="row"><span class="label">Servicio</span><span class="value">${appt.service_name}</span></div>
      <div class="row"><span class="label">Duración</span><span class="value">${appt.service_duration} min</span></div>
      <div class="row"><span class="label">Precio</span><span class="value highlight">${formatPrice(appt.service_price)}</span></div>
      <div class="row"><span class="label">Fecha</span><span class="value highlight">${formatDate(appt.appointment_date)}</span></div>
      <div class="row"><span class="label">Hora</span><span class="value highlight">${formatTime(appt.appointment_time)}</span></div>
      ${appt.notes ? `<div class="row"><span class="label">Notas</span><span class="value">${appt.notes}</span></div>` : ''}
    </div>
    <div class="footer">Angel Barber Shop · Sistema de citas · Este es un correo automático</div>
  </div>
</div>
</body></html>`;
}

// Plain-text fallback for barber
function barberNewAppointmentText(appt) {
  return `
NUEVA CITA — Angel Barber Shop
================================
Cliente  : ${appt.client_name}
Teléfono : ${appt.client_phone}
Servicio : ${appt.service_name} (${appt.service_duration} min)
Precio   : ${formatPrice(appt.service_price)}
Fecha    : ${formatDate(appt.appointment_date)}
Hora     : ${formatTime(appt.appointment_time)}
${appt.notes ? 'Notas    : ' + appt.notes : ''}
================================
Este es un mensaje automático de Angel Barber Shop.
`.trim();
}

// ── Send functions ────────────────────────────────────────────────────────────

/**
 * Send new-appointment email to the barber.
 * Silently skips if email is not configured or barber has no email.
 */
async function sendNewAppointmentEmail(appt, barberEmail) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('📧 Email not configured — skipping notification');
    return;
  }
  if (!barberEmail) {
    console.log('📧 Barber has no email — skipping notification');
    return;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"Angel Barber Shop" <${process.env.EMAIL_USER}>`,
      to:      barberEmail,
      subject: `✂ Nueva cita: ${appt.client_name} — ${formatDate(appt.appointment_date)} ${formatTime(appt.appointment_time)}`,
      text:    barberNewAppointmentText(appt),
      html:    barberNewAppointmentHtml(appt),
    });
    console.log(`📧 Email enviado a ${barberEmail}`);
  } catch (err) {
    // Never crash the main flow because of email
    console.error('📧 Error enviando email:', err.message);
  }
}

/**
 * Send cancellation notice to barber.
 */
async function sendCancellationEmail(appt, barberEmail) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !barberEmail) return;
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"Angel Barber Shop" <${process.env.EMAIL_USER}>`,
      to:      barberEmail,
      subject: `❌ Cita cancelada: ${appt.client_name} — ${formatDate(appt.appointment_date)}`,
      text: `Cita CANCELADA\nCliente: ${appt.client_name}\nFecha: ${formatDate(appt.appointment_date)} ${formatTime(appt.appointment_time)}\nServicio: ${appt.service_name}`,
      html: `<div style="font-family:Arial;background:#0a0a0a;color:#f0ece4;padding:24px;border-radius:12px;max-width:480px;margin:auto">
        <h2 style="color:#e05555">❌ Cita Cancelada</h2>
        <p><strong>Cliente:</strong> ${appt.client_name}</p>
        <p><strong>Fecha:</strong> ${formatDate(appt.appointment_date)} a las ${formatTime(appt.appointment_time)}</p>
        <p><strong>Servicio:</strong> ${appt.service_name}</p>
        <p style="color:#555;font-size:12px">Angel Barber Shop · Sistema automático</p>
      </div>`,
    });
    console.log(`📧 Cancelación enviada a ${barberEmail}`);
  } catch (err) {
    console.error('📧 Error enviando cancelación:', err.message);
  }
}

module.exports = { sendNewAppointmentEmail, sendCancellationEmail };
