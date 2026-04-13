// Require any authenticated user
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'No autenticado. Inicia sesión.' });
  }
  next();
};

// Require admin role only
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'No autenticado.' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acceso denegado. Solo el administrador puede realizar esta acción.' });
  }
  next();
};

module.exports = { requireAuth, requireAdmin };
