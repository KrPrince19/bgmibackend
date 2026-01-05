const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));

const server = http.createServer(app);

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"], 
});

io.on("connection", (socket) => {
  console.log("🟢 Admin/Client connected:", socket.id);
});

/* ================= EMIT HELPER ================= */
const emitDBUpdate = (event, payload = null) => {
  console.log(`📡 BROADCASTING EVENT: ${event}`);
  io.emit("db-update", {
    event,
    payload,
    time: new Date(),
  });
};

/* ================= DB ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(console.error);

const db = mongoose.connection;

/* ---------------- TOURNAMENT POST ROUTE (FOR ADMIN UPLOADER) ---------------- */
app.post("/tournament", async (req, res) => {
  const { collection, data } = req.body;

  if (!collection || !Array.isArray(data)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    // 1. Insert into MongoDB
    await db.collection(collection).insertMany(data);

    // 2. 🔥 SOCKET LOGIC: Map collections to your frontend events
    // This ensures when you click "Submit" in AdminUploader, the UI updates
    const eventMap = {
      "tournament": "TOURNAMENT_ADDED",
      "upcomingtournament": "TOURNAMENT_ADDED", // Matches your frontend listener
      "upcomingscrim": "UPCOMING_SCRIM_ADDED",
      "winner": "WINNER_UPDATED",
      "leaderboard": "LEADERBOARD_UPDATED",
      "tournamentdetail": "DETAIL_UPDATED",
      "joinmatches": "JOIN_MATCH"
    };

    const eventToEmit = eventMap[collection];
    if (eventToEmit) {
      emitDBUpdate(eventToEmit, data);
    }

    res.json({ message: "Saved successfully and broadcasted to clients" });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Database insertion failed" });
  }
});

/* ---------------- DYNAMIC GET ROUTES ---------------- */
const collections = [
  "tournament", 
  "upcomingscrim", 
  "upcomingtournament", 
  "leaderboard", 
  "winner", 
  "tournamentdetail", 
  "joinmatches"
];

collections.forEach(col => {
  app.get(`/${col}`, async (_, res) => {
    try {
      const data = await db.collection(col).find({}).toArray();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: `Fetch error for ${col}` });
    }
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
