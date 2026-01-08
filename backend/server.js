const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));

// Socket.io Setup
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
});

// Helper for real-time updates
const emitDBUpdate = (event, payload = null) => {
  console.log(`📡 Broadcasting Socket Event: ${event}`);
  io.emit("db-update", { event, payload });
};

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const db = mongoose.connection;

// --- ROUTES ---

/**
 * POST /tournament
 * Handles adding data to various collections and triggers socket events
 */
app.post("/tournament", async (req, res) => {
  const { collection, data } = req.body;
  if (!collection || !data) return res.status(400).json({ error: "Invalid payload" });
  
  try {
    const dataArray = Array.isArray(data) ? data : [data];
    await db.collection(collection).insertMany(dataArray);
    
    // Map collections to the specific event names your frontend expects
    const eventMap = {
      tournament: "TOURNAMENT_DETAIL_UPDATED", // Matches your DetailPage.jsx listener
      upcomingtournament: "TOURNAMENT_ADDED",
      upcomingscrim: "UPCOMING_SCRIM_ADDED",
      joinmatches: "JOIN_MATCH",
      winner: "WINNER",
      leaderboard: "LEADERBOARD_ADDED"
    };

    if (eventMap[collection]) {
      emitDBUpdate(eventMap[collection], dataArray);
    } else {
      emitDBUpdate("GENERAL_UPDATE", dataArray);
    }

    res.json({ message: "✅ Data inserted successfully", collection });
  } catch (err) {
    console.error(`❌ POST Error in ${collection}:`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /tournamentdetail/:id
 * Fetches a single tournament by its custom tournamentId string
 */
app.get("/tournamentdetail/:id", async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database not ready" });
  }

  try {
    const { id } = req.params;
    console.log(`🔍 Fetching details for tournamentId: ${id}`);

    // Query the 'tournament' collection for the custom 'tournamentId' field
    const tournament = await db.collection("tournament").findOne({ 
      tournamentId: id 
    });

    if (!tournament) {
      return res.status(404).json({ error: `Tournament with ID '${id}' not found` });
    }
    
    res.json(tournament);
  } catch (err) {
    console.error(`❌ Fetch failed for ${req.params.id}:`, err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Dynamic GET Routes
 * Generates endpoints like /tournament, /upcomingscrim, etc.
 */
const collections = [
  "tournament", 
  "upcomingscrim", 
  "upcomingtournament", 
  "joinmatches", 
  "winner", 
  "leaderboard",
  "tournamentdetail" // Included to support the general list fetch if needed
];

collections.forEach((col) => {
  app.get(`/${col}`, async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database not ready" });
    }

    try {
      const data = await db.collection(col).find({}).toArray();
      res.json(data);
    } catch (err) {
      console.error(`❌ Fetch failed for ${col}:`, err);
      res.status(500).json({ error: `Could not fetch data from ${col}` });
    }
  });
});

// Root check
app.get("/", (req, res) => {
  res.send("BGMI Tournament Backend is running...");
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server is live on port ${PORT}`);
});
