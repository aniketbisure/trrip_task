import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const DATA_DIR = path.join(process.cwd(), "data");

// Unified schemas types
export interface UserDoc {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

export interface Activity {
  time?: string;
  activity: string;
  location?: string;
  description?: string;
}

export interface DayPlan {
  day: number;
  theme?: string;
  activities: Activity[];
}

export interface ItineraryDoc {
  id: string;
  userId?: string;
  creatorName: string;
  title: string;
  destination: string;
  duration: string;
  days: DayPlan[];
  additionalNotes?: string;
  shareId: string;
  rawText?: string;
  createdAt: Date;
}

// ----------------------------------------------------
// Real Mongoose Setup
// ----------------------------------------------------
let useMongoose = false;

// Mongoose Schemas
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ItinerarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  creatorName: { type: String, required: true },
  title: { type: String, required: true },
  destination: { type: String, required: true },
  duration: { type: String, required: true },
  days: [{
    day: { type: Number, required: true },
    theme: { type: String },
    activities: [{
      time: { type: String },
      activity: { type: String, required: true },
      location: { type: String },
      description: { type: String }
    }]
  }],
  additionalNotes: { type: String },
  shareId: { type: String, required: true, unique: true },
  rawText: { type: String },
  createdAt: { type: Date, default: Date.now },
});

let UserModel: any = null;
let ItineraryModel: any = null;

try {
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    console.log("Database: MONGODB_URI found. Connecting...");
    // Connect to MongoDB with 3s timeout and handle promise rejection gracefully
    mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    }).then(() => {
      console.log("Database: Successfully connected to MongoDB Atlas!");
      useMongoose = true;
    }).catch((err: any) => {
      console.error("Database: Initial MongoDB Atlas connection failed. Falling back to robust local JSON store.", err.message);
      useMongoose = false;
    });
    
    mongoose.connection.on("connected", () => {
      console.log("Database: Successfully connected to MongoDB Atlas!");
      useMongoose = true;
    });

    mongoose.connection.on("error", (err) => {
      console.error("Database: MongoDB socket/connection error. Keeping fallback active.", err.message);
      useMongoose = false;
    });

    UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
    ItineraryModel = mongoose.models.Itinerary || mongoose.model("Itinerary", ItinerarySchema);
  } else {
    if (process.env.NODE_ENV === "production") {
      console.error("FATAL ERROR: MONGODB_URI is required in production. Local JSON store is disabled.");
      process.exit(1);
    }
    console.log("Database: No MONGODB_URI set. Using robust local JSON fallback store.");
  }
} catch (e: any) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL ERROR: Failed to initialize MongoDB in production:", e.message);
    process.exit(1);
  }
  console.error("Database: Error initializing MongoDB. Falling back to JSON store:", e.message);
  useMongoose = false;
}

// ----------------------------------------------------
// Local JSON Base Setup (Fallback)
// ----------------------------------------------------
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const ITINERARIES_FILE = path.join(DATA_DIR, "itineraries.json");

function readJsonFile<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Database: Error reading ${filePath}, writing default.`, e);
  }
  fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
  return defaultVal;
}

function writeJsonFile<T>(filePath: string, data: T) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Database: Error writing to ${filePath}`, e);
  }
}

// ----------------------------------------------------
// Unified Database Interface
// ----------------------------------------------------
export const db = {
  getIsUsingMongo(): boolean {
    return useMongoose;
  },

  users: {
    async findOne(filter: { email: string }): Promise<UserDoc | null> {
      if (useMongoose && UserModel) {
        try {
          const u = await UserModel.findOne({ email: filter.email.toLowerCase() }).lean();
          if (u) {
            return {
              id: u._id.toString(),
              email: u.email,
              passwordHash: u.passwordHash,
              name: u.name,
              createdAt: u.createdAt,
            };
          }
          return null;
        } catch (e) {
          console.error("Mongoose findOne error, checking fallback:", e);
        }
      }
      
      const users = readJsonFile<UserDoc[]>(USERS_FILE, []);
      const match = users.find(u => u.email.toLowerCase() === filter.email.toLowerCase());
      return match || null;
    },

    async findById(id: string): Promise<UserDoc | null> {
      if (useMongoose && UserModel) {
        try {
          const u = await UserModel.findById(id).lean();
          if (u) {
            return {
              id: u._id.toString(),
              email: u.email,
              passwordHash: u.passwordHash,
              name: u.name,
              createdAt: u.createdAt,
            };
          }
        } catch (e) {
          console.error("Mongoose findById error:", e);
        }
      }

      const users = readJsonFile<UserDoc[]>(USERS_FILE, []);
      return users.find(u => u.id === id) || null;
    },

    async create(user: { email: string; name: string; passwordHash: string }): Promise<UserDoc> {
      const normalizedEmail = user.email.toLowerCase();
      if (useMongoose && UserModel) {
        try {
          const u = await UserModel.create({
            email: normalizedEmail,
            name: user.name,
            passwordHash: user.passwordHash,
          });
          return {
            id: u._id.toString(),
            email: u.email,
            name: u.name,
            passwordHash: u.passwordHash,
            createdAt: u.createdAt,
          };
        } catch (e) {
          console.error("Mongoose create user error, using fallback:", e);
        }
      }

      const users = readJsonFile<UserDoc[]>(USERS_FILE, []);
      const newId = Math.random().toString(36).substring(2, 11);
      const newUser: UserDoc = {
        id: newId,
        email: normalizedEmail,
        name: user.name,
        passwordHash: user.passwordHash,
        createdAt: new Date(),
      };
      users.push(newUser);
      writeJsonFile(USERS_FILE, users);
      return newUser;
    }
  },

  itineraries: {
    async create(itinerary: Omit<ItineraryDoc, "id" | "createdAt">): Promise<ItineraryDoc> {
      if (useMongoose && ItineraryModel) {
        try {
          const doc = await ItineraryModel.create({
            userId: itinerary.userId ? new mongoose.Types.ObjectId(itinerary.userId) : undefined,
            creatorName: itinerary.creatorName,
            title: itinerary.title,
            destination: itinerary.destination,
            duration: itinerary.duration,
            days: itinerary.days,
            additionalNotes: itinerary.additionalNotes,
            shareId: itinerary.shareId,
            rawText: itinerary.rawText,
          });
          return {
            id: doc._id.toString(),
            userId: itinerary.userId,
            creatorName: doc.creatorName,
            title: doc.title,
            destination: doc.destination,
            duration: doc.duration,
            days: doc.days as DayPlan[],
            additionalNotes: doc.additionalNotes,
            shareId: doc.shareId,
            rawText: doc.rawText,
            createdAt: doc.createdAt,
          };
        } catch (e) {
          console.error("Mongoose create itinerary error, using fallback:", e);
        }
      }

      const list = readJsonFile<ItineraryDoc[]>(ITINERARIES_FILE, []);
      const newId = Math.random().toString(36).substring(2, 11);
      const newItinerary: ItineraryDoc = {
        ...itinerary,
        id: newId,
        createdAt: new Date(),
      };
      list.push(newItinerary);
      writeJsonFile(ITINERARIES_FILE, list);
      return newItinerary;
    },

    async findByUser(userId: string): Promise<ItineraryDoc[]> {
      if (useMongoose && ItineraryModel) {
        try {
          const docs = await ItineraryModel.find({ userId: new mongoose.Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .lean();
          return docs.map((doc: any) => ({
            id: doc._id.toString(),
            userId: doc.userId?.toString(),
            creatorName: doc.creatorName,
            title: doc.title,
            destination: doc.destination,
            duration: doc.duration,
            days: doc.days as DayPlan[],
            additionalNotes: doc.additionalNotes,
            shareId: doc.shareId,
            rawText: doc.rawText,
            createdAt: doc.createdAt,
          }));
        } catch (e) {
          console.error("Mongoose findByUser error, checking fallback:", e);
        }
      }

      const list = readJsonFile<ItineraryDoc[]>(ITINERARIES_FILE, []);
      return list
        .filter(it => it.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async findByShareId(shareId: string): Promise<ItineraryDoc | null> {
      if (useMongoose && ItineraryModel) {
        try {
          const doc = await ItineraryModel.findOne({ shareId }).lean();
          if (doc) {
            return {
              id: doc._id.toString(),
              userId: doc.userId?.toString(),
              creatorName: doc.creatorName,
              title: doc.title,
              destination: doc.destination,
              duration: doc.duration,
              days: doc.days as DayPlan[],
              additionalNotes: doc.additionalNotes,
              shareId: doc.shareId,
              rawText: doc.rawText,
              createdAt: doc.createdAt,
            };
          }
          return null;
        } catch (e) {
          console.error("Mongoose findByShareId error, checking fallback:", e);
        }
      }

      const list = readJsonFile<ItineraryDoc[]>(ITINERARIES_FILE, []);
      return list.find(it => it.shareId === shareId) || null;
    },

    async delete(id: string, userId: string): Promise<boolean> {
      if (useMongoose && ItineraryModel) {
        try {
          const res = await ItineraryModel.deleteOne({ _id: id, userId: new mongoose.Types.ObjectId(userId) });
          return res.deletedCount > 0;
        } catch (e) {
          console.error("Mongoose delete itinerary error, trying local fallback:", e);
        }
      }

      const list = readJsonFile<ItineraryDoc[]>(ITINERARIES_FILE, []);
      const lengthBefore = list.length;
      const filtered = list.filter(it => !(it.id === id && it.userId === userId));
      writeJsonFile(ITINERARIES_FILE, filtered);
      return filtered.length < lengthBefore;
    }
  }
};
