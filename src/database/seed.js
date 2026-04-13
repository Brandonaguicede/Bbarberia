const { pool } = require('./connection');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

async function seed() {
  const connection = await pool.getConnection();
  try {
    console.log('🌱 Seeding database...');

    const [barbers] = await connection.query('SELECT COUNT(*) as count FROM barbers');
    if (barbers[0].count > 0) {
      console.log('⚠️  Database already has data, skipping seed.');
      return;
    }

    // Seed barbers
    const barberIds = [uuidv4(), uuidv4(), uuidv4()];
    const barberData = [
      [barberIds[0], 'Carlos Mendoza', 'Cortes clásicos & fade', '8888-1111', 'carlos@barbershop.com'],
      [barberIds[1], 'Javier Rojas', 'Barba & diseño', '8888-2222', 'javier@barbershop.com'],
      [barberIds[2], 'Andrés López', 'Coloración & texturas', '8888-3333', 'andres@barbershop.com'],
    ];
    for (const b of barberData) {
      await connection.query(
        'INSERT INTO barbers (id, name, specialty, phone, email) VALUES (?, ?, ?, ?, ?)', b
      );
    }

    // Seed services
    const serviceData = [
      [uuidv4(), 'Corte Clásico', 'Corte tradicional con tijeras y máquina', 30, 8000.00, 'corte'],
      [uuidv4(), 'Corte + Barba', 'Corte completo más arreglo de barba con navaja', 50, 12000.00, 'combo'],
      [uuidv4(), 'Fade / Degradado', 'Degradado moderno a máquina con acabado perfecto', 35, 10000.00, 'corte'],
      [uuidv4(), 'Arreglo de Barba', 'Perfilado y arreglo de barba con navaja', 25, 6000.00, 'barba'],
      [uuidv4(), 'Afeitado Tradicional', 'Afeitado clásico con navaja y toalla caliente', 30, 7000.00, 'barba'],
      [uuidv4(), 'Coloración', 'Tinte o decoloración de cabello', 60, 15000.00, 'color'],
    ];
    for (const s of serviceData) {
      await connection.query(
        'INSERT INTO services (id, name, description, duration, price, category) VALUES (?, ?, ?, ?, ?, ?)', s
      );
    }

    // Seed users
    const adminPass = await bcrypt.hash('admin123', 10);
    const pass1     = await bcrypt.hash('carlos123', 10);
    const pass2     = await bcrypt.hash('javier123', 10);
    const pass3     = await bcrypt.hash('andres123', 10);

    const usersData = [
      [uuidv4(), 'admin',  adminPass, 'admin',  null],
      [uuidv4(), 'carlos', pass1,     'barber', barberIds[0]],
      [uuidv4(), 'javier', pass2,     'barber', barberIds[1]],
      [uuidv4(), 'andres', pass3,     'barber', barberIds[2]],
    ];
    for (const u of usersData) {
      await connection.query(
        'INSERT INTO users (id, username, password, role, barber_id) VALUES (?, ?, ?, ?, ?)', u
      );
    }

    console.log('✅ Seed completed:');
    console.log('   👤 admin    → contraseña: admin123  (rol: admin)');
    console.log('   👤 carlos   → contraseña: carlos123 (rol: barbero)');
    console.log('   👤 javier   → contraseña: javier123 (rol: barbero)');
    console.log('   👤 andres   → contraseña: andres123 (rol: barbero)');
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seed };
