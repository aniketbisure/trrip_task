import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL ERROR: JWT_SECRET environment variable is missing in production.");
    process.exit(1);
  }
  console.warn("WARNING: JWT_SECRET is missing. Using insecure default for development.");
  JWT_SECRET = "trrip_secure_jwt_secret_token_key_2026";
}

// @route   POST /api/auth/register
// @desc    Register a new user
router.post("/register", async (req: any, res: any) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: "Please provide email, password, and name." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long." });
      return;
    }

    // Check existing user
    const existingUser = await db.users.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: "An account with this email already exists." });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await db.users.create({
      email,
      name,
      passwordHash,
    });

    // Create JWT
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, name: newUser.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server registration failure. Please try again." });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
router.post("/login", async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Please provide email and password." });
      return;
    }

    // Find user
    const user = await db.users.findOne({ email });
    if (!user) {
      res.status(400).json({ error: "Invalid email or password credentials." });
      return;
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: "Invalid email or password credentials." });
      return;
    }

    // Create JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server login failure. Please try again." });
  }
});

// @route   GET /api/auth/me
// @desc    Get current authenticated user info
router.get("/me", authenticateToken, async (req: any, res: any) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "User unauthorized" });
      return;
    }

    const user = await db.users.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    console.error("Get user context error:", error);
    res.status(500).json({ error: "Failed to fetch user context data." });
  }
});

export default router;
