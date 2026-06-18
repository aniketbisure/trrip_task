import { Router } from "express";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import jwt from "jsonwebtoken";
import { db, DayPlan } from "../db/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { PDFParse } from "pdf-parse";
import os from "os";
import fs from "fs";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

const router = Router();

// Multer disk-based upload setup (prevents OOM crashes in production)
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const ext = file.originalname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "upload";
      cb(null, `${Date.now()}-${crypto.randomUUID()}.${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max sizing
});

// Rate limiting to prevent abuse of the Gemini API
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { error: "Too many itineraries generated from this IP, please try again after 15 minutes." }
});

// Lazy initialize Google Gen AI client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("API Warning: GEMINI_API_KEY environment variable is not defined.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper: Optional token decoding to attach to registered user when generating itineraries
async function tryGetUserId(authHeader?: string): Promise<{ userId?: string; userName?: string } | null> {
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) return null;
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; name: string };
    return { userId: payload.userId, userName: payload.name };
  } catch (e) {
    return null;
  }
}

// @route   POST /api/itinerary/generate
// @desc    Upload document or paste text, and run Gemini AI to produce structured itinerary
router.post("/generate", generateLimiter, upload.single("file") as any, async (req: any, res: any) => {
  try {
    const rawText = req.body.rawText;
    const file = req.file;
    const manualDestination = req.body.destination;

    if (!rawText && !file && !manualDestination) {
      res.status(400).json({ error: "Please upload a travel document, paste booking details, or select a manual destination." });
      return;
    }

    // Determine user session if they are logged in (to save in history)
    const userSession = await tryGetUserId(req.headers["authorization"]);
    const userId = userSession?.userId;
    const creatorName = userSession?.userName || "Traveler Guest";

    let resultJson: any = null;
    let extractedText = "";

    // If Gemini API Key is missing, give clear error message
    if (!process.env.GEMINI_API_KEY) {
      res.status(400).json({ error: "Gemini API key is not configured. Please define GEMINI_API_KEY in the environment settings." });
      return;
    }

    try {
      const ai = getAiClient();
      let promptText = `
          You are a professional travel curator for Trrip.
          Based on the attached travel document details, extract booking items (flight dates, destinations, airlines, hotels, train routes) and generate a comprehensive day-by-day travel itinerary.
          
          Guidelines:
          - If the details contain specific destination cities, use them.
          - If the details are brief, automatically design a highly realistic, detailed day-by-day vacation itinerary for that destination starting from the booking dates.
          - Ensure the itinerary includes exact activity items, real-world recommendations, breakfast, lunch, and dinner activities with times, and specific descriptions.
          - Return the response in strictly JSON format matching this schema:
          {
            "title": "String - Descriptive title of the trip (e.g. Romance in Paris, Culinary Tokyo Adventure)",
            "destination": "String - Main destination city and country",
            "duration": "String - e.g. 4 Days, 3 Nights",
            "days": [
              {
                "day": Integer - Day number e.g. 1, 2, 3,
                "theme": "String - Theme or focus of the day",
                "activities": [
                  {
                    "time": "String - Time of day (e.g. 09:00 AM, 02:30 PM)",
                    "activity": "String - High-impact title for the activity",
                    "location": "String - Location name or hotspot",
                    "description": "String - Context, tips, what to do, what to try there."
                  }
                ]
              }
            ],
            "additionalNotes": "String - Packing suggestions, transport hints, local secrets, weather reminders."
          }
        `;

        if (manualDestination) {
          promptText += `\nAdditional Focus: The user explicitly specified preferring the destination "${manualDestination}". Ensure you build the itinerary around this city and include all relevant context.`;
        }

        let contents: any = promptText;

        // Multimodal handling for images/PDFs
        if (file) {
          const supportedMimeTypes = [
            "image/png", "image/jpeg", "image/jpg", "image/webp",
            "application/pdf"
          ];
          let mimeType = file.mimetype;
          if (!supportedMimeTypes.includes(mimeType)) {
            // Safe fallbacks based on original extension
            const ext = file.originalname.split(".").pop()?.toLowerCase();
            if (ext === "pdf") mimeType = "application/pdf";
            else if (ext === "png") mimeType = "image/png";
            else if (["jpeg", "jpg"].includes(ext || "")) mimeType = "image/jpeg";
            else mimeType = "image/png"; // Default fallback
          }

          // Read file back from disk temp storage for processing
          const fileBuffer = fs.readFileSync(file.path);

          // If PDF, first extract pure text using pdf-parse to bypass base64 size limits
          if (mimeType === "application/pdf") {
            try {
              console.log(`Analyzing file "${file.originalname}" of size ${file.size} bytes using pdf-parse...`);
              const parser = new PDFParse({ data: fileBuffer });
              const textResult = await parser.getText();
              extractedText = textResult.text || "";
              await parser.destroy();
              console.log(`Document text extracted successfully. Character length: ${extractedText.length}`);
            } catch (pdfErr: any) {
              console.error("PDF-parse extraction warning:", pdfErr.message);
            }
          }

          const base64Data = fileBuffer.toString("base64");
          const parts: any[] = [];

          // If high-fidelity text was extracted from the PDF, use it to build a robust prompt
          if (extractedText && extractedText.trim().length > 30) {
            contents = promptText + `\n\n----------------------------\nUPLOADED TRAVEL DOCUMENT TEXT CONTENT (Extracted from "${file.originalname}"):\n\n${extractedText}\n----------------------------\n\nParse all details from the extracted text above, determine the target destinations (like Mount Kailash or Lake Mansarovar) and construct an elite day-by-day travel plan.`;
          } else {
            // If it's a small file (under 5MB), send inlineData, otherwise use textual description to prevent timeouts
            if (fileBuffer.length <= 5 * 1024 * 1024) {
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              });
            }
            parts.push({
              text: promptText + `\nThe document uploaded is named "${file.originalname}" which may be an image or PDF. Parse all textual booking elements inside it.`
            });
            contents = { role: "user", parts };
          }
        } else if (rawText) {
          contents = promptText + `\nThe user provided this text summary of their bookings:\n"""\n${rawText}\n"""`;
        }

        let aiResponse: Awaited<ReturnType<ReturnType<typeof getAiClient>["models"]["generateContent"]>> | undefined;
        let attempt = 0;
        const maxRetries = 3;
        while (attempt <= maxRetries) {
          try {
            aiResponse = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: contents,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  required: ["title", "destination", "duration", "days"],
                  properties: {
                    title: { type: Type.STRING },
                    destination: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    days: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        required: ["day", "theme", "activities"],
                        properties: {
                          day: { type: Type.INTEGER },
                          theme: { type: Type.STRING },
                          activities: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              required: ["activity", "description"],
                              properties: {
                                time: { type: Type.STRING },
                                activity: { type: Type.STRING },
                                location: { type: Type.STRING },
                                description: { type: Type.STRING }
                              }
                            }
                          }
                        }
                      }
                    },
                    additionalNotes: { type: Type.STRING }
                  }
                }
              }
            });
            break;
          } catch (err: any) {
            const errString = String(err) + " " + (err?.message || "") + " " + JSON.stringify(err, Object.getOwnPropertyNames(err));
            const isRetryable = errString.includes("503") || errString.includes("429") || errString.includes("UNAVAILABLE") || errString.includes("fetch failed") || errString.includes("ECONNRESET");
            if (isRetryable && attempt < maxRetries) {
              attempt++;
              // Increased base delay to 5 seconds to provide much more recovery time for large files
              const delay = Math.pow(2, attempt) * 5000 + Math.random() * 2000;
              console.warn(`Gemini API busy or network error. Retrying in ${Math.round(delay/1000)}s... (Attempt ${attempt} of ${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw err;
            }
          }
        }

        if (!aiResponse) {
          throw new Error("Gemini did not return a response after retry attempts.");
        }

        const rawResultText = aiResponse.text;
        if (!rawResultText) {
          throw new Error("Empty response received from Gemini engine.");
        }

        resultJson = JSON.parse(rawResultText);
    } catch (geminiError: any) {
      console.error("Gemini processing error:", geminiError.message);
      res.status(500).json({ error: `Failed to compile travel journal. Gemini processing error: ${geminiError.message || "Unknown model generation error."}` });
      return;
    }

    // Generate custom share ID
    const shareId = crypto.randomBytes(8).toString("hex");

    // Save itinerary to database
    const savedDoc = await db.itineraries.create({
      userId,
      creatorName,
      title: resultJson.title,
      destination: resultJson.destination,
      duration: resultJson.duration,
      days: resultJson.days as DayPlan[],
      additionalNotes: resultJson.additionalNotes,
      shareId,
      rawText: rawText || (file ? `Parsed file: ${file.originalname}` : "Manual Entry"),
    });

    res.status(201).json({
      itinerary: savedDoc,
      extractedPreview: extractedText ? extractedText.substring(0, 500) + "..." : null
    });

  } catch (error: any) {
    console.error("Itinerary generation error:", error);
    res.status(500).json({ error: "Failed to create itinerary. Try pasting your booking directly as plain text." });
  } finally {
    // Ensure the temporary file is deleted from disk to prevent storage leaks
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error("Error cleaning up temporary file:", cleanupErr);
      }
    }
  }
});

// @route   GET /api/itinerary/history
// @desc    Retrieve logged-in user itineraries
router.get("/history", authenticateToken, async (req: any, res: any) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized access." });
      return;
    }

    const history = await db.itineraries.findByUser(req.userId);
    res.json(history);
  } catch (error: any) {
    console.error("Fetch history error:", error);
    res.status(500).json({ error: "Failed to retrieve historic itineraries." });
  }
});

// @route   GET /api/itinerary/share/:shareId
// @desc    Verify and fetch itinerary detail for public view
router.get("/share/:shareId", async (req: any, res: any) => {
  try {
    const shareId = req.params.shareId;
    const doc = await db.itineraries.findByShareId(shareId);

    if (!doc) {
      res.status(404).json({ error: "Travel itinerary could not be found or link has expired." });
      return;
    }

    res.json(doc);
  } catch (error: any) {
    console.error("Retrieve shared plan error:", error);
    res.status(500).json({ error: "Failed to open shared itinerary." });
  }
});

// @route   DELETE /api/itinerary/:id
// @desc    Delete itinerary from history
router.delete("/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const id = req.params.id;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Access denied." });
      return;
    }

    const success = await db.itineraries.delete(id, userId);

    if (!success) {
      res.status(404).json({ error: "Itinerary not found or you do not have deletion rights." });
      return;
    }

    res.json({ message: "Successfully deleted itinerary.", id });
  } catch (error: any) {
    console.error("Delete itinerary error:", error);
    res.status(500).json({ error: "Failed to delete itinerary option from database." });
  }
});

export default router;
