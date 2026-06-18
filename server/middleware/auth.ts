import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL ERROR: JWT_SECRET environment variable is missing in production.");
    process.exit(1);
  }
  JWT_SECRET = "trrip_secure_jwt_secret_token_key_2026";
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

export function authenticateToken(req: any, res: any, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access denied. Token missing." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; name: string };
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userName = payload.name;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token." });
  }
}
