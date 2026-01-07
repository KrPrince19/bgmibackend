const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
});

// Helper for real-time updates
const emitDBUpdate = (event, payload = null) => {
  console.log(`📡 Broadcasting: ${event}`);
  io.emit("db-update", { event, payload });
};

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const db = mongoose.connection;

// --- ROUTES ---

app.post("/tournament", async (req, res) => {
  const { collection, data } = req.body;
  if (!collection || !data) return res.status(400).json({ error: "Invalid payload" });
  
  try {
    const dataArray = Array.isArray(data) ? data : [data];
    await db.collection(collection).insertMany(dataArray);
    
    const eventMap = {
      tournament: "TOURNAMENT_ADDED",
      upcomingtournament: "TOURNAMENT_ADDED",
      upcomingscrim: "UPCOMING_SCRIM_ADDED",
      joinmatches: "JOIN_MATCH",
      winner: "WINNER",
      leaderboard: "LEADERBOARD_ADDED"
    };

    if (eventMap[collection]) emitDBUpdate(eventMap[collection], dataArray);
    res.json({ message: "✅ Success", collection });
  } catch (err) {
    console.error(`❌ POST Error in ${collection}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Dynamic Get Routes with improved error logging
const cols = ["tournament", "upcomingscrim", "upcomingtournament", "joinmatches", "winner", "leaderboard"];

cols.forEach((col) => {
  app.get(`/${col}`, async (req, res) => {
    // 1. Check if DB is actually connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database not ready yet" });
    }

    try {
      // 2. Fetch data
      const data = await db.collection(col).find({}).toArray();
      res.json(data);
    } catch (err) {
      console.error(`❌ Fetch failed for ${col}:`, err); // This will tell you the EXACT error
      res.status(500).json({ error: `Fetch failed for ${col}` });
    }
  });
});

server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
