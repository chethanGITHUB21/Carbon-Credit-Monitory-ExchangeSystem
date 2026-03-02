// server.js — Node.js Auth + API Gateway
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./routes/auth");
const carbonRoutes = require("./routes/carbon");

const app = express();

// ── Security middleware ───────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use(limiter);

// ── Parsing & logging ─────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// ── Static frontend ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ── API Routes ────────────────────────────────────────────────
app.use("/auth", authLimiter, authRoutes);
app.use("/carbon", carbonRoutes);

// ── Frontend page routes ──────────────────────────────────────
const frontendPages = [
  "/",
  "/login",
  "/register",
  "/dashboard",
  "/buyer",
  "/seller",
  "/marketplace",
];
frontendPages.forEach((route) => {
  app.get(route, (req, res) => {
    const pageMap = {
      "/": "index.html",
      "/login": "pages/login.html",
      "/register": "pages/register.html",
      "/dashboard": "pages/dashboard.html",
      "/buyer": "pages/buyer.html",
      "/seller": "pages/seller.html",
      "/marketplace": "pages/marketplace.html",
    };
    res.sendFile(path.join(__dirname, "..", "frontend", pageMap[route]));
  });
});

// ── Health check ──────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "carbon-gateway" }),
);

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🌍 Carbon Gateway running on http://localhost:${PORT}`);
  console.log(
    `   FastAPI engine: ${process.env.FASTAPI_URL || "http://localhost:8000"}`,
  );
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}\n`);
});

module.exports = app;
