# Trrip - AI Travel Itinerary Generator

Trrip is a next-generation MERN-stack web application designed to help travelers instantly convert booking details into beautifully curated travel itineraries. By uploading PDFs, images, or pasting booking confirmations, the system extracts critical trip markers (flight details, hotels, reservations) and utilizes the Google Gemini API to structure a personalized day-by-day travel plan.

## 🚀 Key Features

- **JWT-Based Authentication**: Secure login and registration.
- **Intelligent Travel Document Parsing**: Upload flight tickets, train tickets, or hotel vouchers (supports PDF, PNG, JPG/JPEG).
- **Multimodal AI Itinerary Generation**: Powered by the Gemini API (`gemini-3.5-flash`) for realistic, day-by-day agendas and timelines.
- **Persistent Storage (MongoDB + Local Fallback)**: Automatically stores generated itineraries in MongoDB. Includes a local JSON-file fallback mechanism for zero-dependency local runs.
- **Interactive Planner Interface**: Switch seamlessly between a Day-by-Day tab schedule and a full vertical timeline stream.
- **Public & Social Sharing**: Generate read-only sharing URLs to share custom plans with travel companions.
- **Modern Responsive UI**: Built with React, TypeScript, Vite, Tailwind CSS, and custom glassmorphic aesthetics. Includes drag-and-drop file handling.

---

## 🛠️ Architecture & Folder Structure

```
trripdoc-ai/
├── src/                 # React Frontend
│   ├── App.tsx          # Main React Application & UI components
│   ├── main.tsx         # App Entry Point
│   ├── index.css        # Core custom styles (Tailwind + Glassmorphism)
│   ├── types.ts         # TypeScript models (Itinerary, DayPlan, User)
│   └── custom.d.ts      # Custom modules types declarations
├── server/              # Express Backend
│   ├── db/
│   │   └── db.ts        # Mongoose connector + unified local database fallback
│   ├── middleware/
│   │   └── auth.ts      # JWT verification middleware
│   └── routes/
│       ├── auth.ts      # User register, login, & verification routes
│       └── itinerary.ts # File upload, data parsing, & Gemini generation routes
├── data/                # Local database fallback storage (JSON files)
├── server.ts            # Node.js Express server entrypoint
└── package.json         # Node.js dependencies & run scripts
```

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Google AI Studio](https://aistudio.google.com/) Gemini API Key

### Configuration

Create a `.env` file in the root directory and configure the variables (see [.env.example](.env.example)):

```env
GEMINI_API_KEY="your_api_key_here"
MONGODB_URI="mongodb+srv://..." # Optional. Falls back to data/ folder if empty
JWT_SECRET="your_jwt_signing_key_here"
```

### Installation & Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   This runs both the React dev environment and the Express API server concurrently.

3. **Build and start production**:
   ```bash
   npm run build
   ```
   Deploy using the build bundle:
   ```bash
   npm start
   ```
