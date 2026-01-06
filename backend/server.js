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
  transports: ["polling", "websocket"], // Allow both for better Render compatibility
});

io.on("connection", (socket) => {
  console.log("🟢 User Connected:", socket.id);
  socket.on("disconnect", () => console.log("🔴 User Disconnected"));
});

const emitDBUpdate = (event, payload = null) => {
  console.log(`📡 Broadcasting: ${event}`);
  io.emit("db-update", { event, payload });
};

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const db = mongoose.connection;

app.post("/tournament", async (req, res) => {
  const { collection, data } = req.body;
  if (!collection || !data) return res.status(400).json({ error: "Invalid payload" });
  const dataArray = Array.isArray(data) ? data : [data];

  try {
    await db.collection(collection).insertMany(dataArray);
    
    const eventMap = {
      tournament: "TOURNAMENT_ADDED",
      upcomingtournament: "TOURNAMENT_ADDED",
      upcomingscrim: "UPCOMING_SCRIM_ADDED",
      joinmatches: "JOIN_MATCH",
      winner:"WINNER",
      leaderboard:"LEADERBOARD_ADDED"
    };

    const eventToEmit = eventMap[collection];
    if (eventToEmit) emitDBUpdate(eventToEmit, dataArray);

    res.json({ message: "✅ Success", collection });
  } catch (err) {
    res.status(500).json({ error: "Insert failed" });
  }
});

// Dynamic Get Routes
const cols = ["tournament", "upcomingscrim", "upcomingtournament", "joinmatches","winner","leaderboard"];
cols.forEach((col) => {
  app.get(`/${col}`, async (req, res) => {
    try {
      const data = await db.collection(col).find({}).toArray();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Fetch failed" });
    }
  });
});

server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
