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

const emitDBUpdate = (event, payload = null) => {
  io.emit("db-update", { event, payload });
};

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const db = mongoose.connection;

// --- POST ROUTE ---
app.post("/tournament", async (req, res) => {
  const { collection, data } = req.body;
  if (!collection || !data) return res.status(400).json({ error: "Invalid payload" });
  
  try {
    const dataArray = Array.isArray(data) ? data : [data];
    await db.collection(collection).insertMany(dataArray);
    
    const eventMap = {
      tournament: "TOURNAMENT_DETAIL_UPDATED",
      upcomingtournament: "TOURNAMENT_ADDED",
      upcomingscrim: "UPCOMING_SCRIM_ADDED",
      joinmatches: "JOIN_MATCH",
      winner: "WINNER",
      leaderboard: "LEADERBOARD_ADDED",
      passedmatch: "PASSED_MATCH_ADDED" 
    };

    emitDBUpdate(eventMap[collection] || "GENERAL_UPDATE", dataArray);
    res.json({ message: "✅ Data inserted successfully", collection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DYNAMIC LIST ROUTES (Used by both DetailPage and PassedDetailPage) ---
const collections = [
  "tournament", 
  "upcomingscrim", 
  "upcomingtournament", 
  "joinmatches", 
  "winner", 
  "leaderboard", 
  "tournamentdetail", // For DetailPage.jsx
  "passedmatch"       // For PassedDetailPage.jsx
];

collections.forEach((col) => {
  app.get(`/${col}`, async (req, res) => {
    try {
      const data = await db.collection(col).find({}).toArray();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: `Could not fetch ${col}` });
    }
  });
});

app.get("/", (req, res) => res.send("BGMI Backend Live"));

server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
