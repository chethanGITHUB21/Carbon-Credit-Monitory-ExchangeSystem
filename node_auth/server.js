// server.js — Node.js Auth + API Gateway
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

// ── Security middleware ─────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({ origin: process.env.FRONTEND_ORIGIN || "*", credentials: true }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ───────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use("/api/", limiter);
app.use("/api/auth/", authLimiter);

// ── Serve frontend static files ─────────────────────────────
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ── API Routes ──────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/carbon", require("./routes/carbon"));
app.use("/api/seller", require("./routes/seller"));

// ── Frontend page routes (SPA-style) ───────────────────────
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html")),
);
app.get("/dashboard", (req, res) =>
  res.sendFile(
    path.join(__dirname, "..", "frontend", "pages", "dashboard.html"),
  ),
);
app.get("/register", (req, res) =>
  res.sendFile(
    path.join(__dirname, "..", "frontend", "pages", "register.html"),
  ),
);
app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "frontend", "pages", "login.html")),
);
app.get("/buyer", (req, res) =>
  res.sendFile(
    path.join(__dirname, "..", "frontend", "pages", "buyer_form.html"),
  ),
);
app.get("/seller", (req, res) =>
  res.sendFile(
    path.join(__dirname, "..", "frontend", "pages", "seller_form.html"),
  ),
);
app.get("/marketplace", (req, res) =>
  res.sendFile(
    path.join(__dirname, "..", "frontend", "pages", "marketplace.html"),
  ),
);

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;

// Create server with proper socket reuse option
const server = app.listen(PORT, () => {
  console.log(`\n🌍 Carbon Credit Exchange — Node.js Gateway`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(
    `   FastAPI Engine: ${process.env.FASTAPI_BASE_URL || "http://localhost:8000"}\n`,
  );
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⛔ Shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
  // Force exit after 10 seconds if still running
  setTimeout(() => {
    console.error("❌ Forced shutdown");
    process.exit(1);
  }, 10000);
});

// Handle port already in use
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.error("   Kill all node processes: taskkill /IM node.exe /F");
    console.error(`   Or use a different port: PORT=3001 node server.js`);
    process.exit(1);
  }
  throw err;
});
