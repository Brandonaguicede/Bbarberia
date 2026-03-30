require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { testConnection } = require("./database/connection");
const { migrate } = require("./database/migrate");
const { seed } = require("./database/seed");

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true, // needed so cookies are sent cross-origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(express.json());

// ── Sessions ──────────────────────────────────────────────────────────────────
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "barbershop_secret_key_change_in_prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // set true in production with HTTPS
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/barbers", require("./routes/barbers"));
app.use("/api/services", require("./routes/services"));
app.use("/api/appointments", require("./routes/appointments"));

// Health check (public)
app.get("/api/health", (_, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// 404
app.use((req, res) =>
  res.status(404).json({ success: false, message: "Ruta no encontrada" }),
);

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ success: false, message: "Error interno del servidor" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await testConnection();
  await migrate();
  await seed();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 API at http://localhost:${PORT}/api`);
  });
}

start();
