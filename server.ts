import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();
console.log('JWT_SECRET:', process.env.JWT_SECRET);

import authRouter from "./server/routes/auth.js";
import itineraryRouter from "./server/routes/itinerary.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Limit payload sizes to 1mb to prevent memory exhaustion DoS attacks
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Strict CORS Headers for Production Security
  app.use(cors({
    origin: process.env.NODE_ENV === "production" 
      ? (process.env.FRONTEND_URL || "https://trrip.com") // Replace with actual production domain
      : "*",
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Content-Length", "X-Requested-With"]
  }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date() });
  });

  // Load API Routers
  app.use("/api/auth", authRouter);
  app.use("/api/itinerary", itineraryRouter);

  // Vite development vs production serving logic
  if (process.env.NODE_ENV !== "production") {
    console.log("Vite: Launching in developmental middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Production: Serving optimized static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`===============================================`);
    console.log(`🚀 Server successfully launched on port ${PORT}`);
    console.log(`🌍 Endpoint: http://localhost:${PORT}`);
    console.log(`===============================================`);
  });
}

// Global uncaught error handlers to prevent silent process exits
process.on("uncaughtException", (err) => {
  console.error("FATAL: Uncaught Exception:", err);
  // In production, you might want to gracefully shutdown or notify a monitoring service here
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("FATAL: Unhandled Promise Rejection at:", promise, "reason:", reason);
});

startServer().catch((err) => {
  console.error("Critical server launch failure:", err);
  process.exit(1);
});

