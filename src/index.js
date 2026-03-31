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
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://barberia-wheat.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // permitir requests sin origin (navegador directo, health checks, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS bloqueado para origen:", origin);
    console.log("✅ Allowed origins:", allowedOrigins);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

// ── Sessions ──────────────────────────────────────────────────────────────────
app.set("trust proxy", 1);

app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "barbershop_secret_key_change_in_prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/barbers", require("./routes/barbers"));
app.use("/api/services", require("./routes/services"));
app.use("/api/appointments", require("./routes/appointments"));

app.get("/api/health", (_, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

app.use((req, res) =>
  res.status(404).json({ success: false, message: "Ruta no encontrada" }),
);

app.use((err, req, res, _next) => {
  console.error(err.stack || err.message);
  res
    .status(500)
    .json({ success: false, message: err.message || "Error interno del servidor" });
});

async function start() {
  await testConnection();

  if (process.env.NODE_ENV !== "production") {
    await migrate();
    await seed();
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log("🌐 Allowed origins:", allowedOrigins);
  });
}

start();
