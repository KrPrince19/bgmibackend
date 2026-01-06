// ================= IMPORTS =================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

// ================= APP SETUP =================
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ================= MIDDLEWARE =================
app.use(express.json());

// ✅ STRONG CORS (Render Safe)
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// ✅ HANDLE PREFLIGHT
app.options("*", cors());

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["polling"], // 🔥 IMPORTANT FOR RENDER
  allowEIO3: true,
});

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ================= SOCKET HELPER =================
const emitDBUpdate = (event, payload = null) => {
  console.log(`📡 EMIT → ${event}`);
  io.emit("db-update", {
    event,
    payload,
    time: new Date(),
  });
};

// ================= DATABASE =================
let dbReady = false;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    dbReady = true;
  })
  .catch((err) => {
    console.error("❌ MongoDB error:", err);
  });

const db = mongoose.connection;

// ================= DB GUARD =================
const ensureDB = (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({
      error: "⏳ Database not ready, try again",
    });
  }
  next();
};

// ================= HEALTH CHECK =================
app.get("/", (_, res) => {
  res.json({ status: "Backend running 🚀" });
});

// ================= ADMIN UPLOADER (POST) =================
app.post("/tournament", ensureDB, async (req, res) => {
  const { collection, data } = req.body;

  if (!collection || !Array.isArray(data)) {
    return res.status(400).json({ error: "❌ Invalid payload" });
  }

  try {
    await db.collection(collection).insertMany(data);

    console.log("✅ Inserted into:", collection);

    // 🔥 EVENT MAP (UNCHANGED)
    const eventMap = {
      tournament: "TOURNAMENT_ADDED",
      upcomingtournament: "TOURNAMENT_ADDED",
      upcomingscrim: "UPCOMING_SCRIM_ADDED",
      tournamentdetail: "DETAIL_UPDATED",
      leaderboard: "LEADERBOARD_UPDATED",
      winner: "WINNER_UPDATED",
      joinmatches: "JOIN_MATCH",
    };

    const eventToEmit = eventMap[collection];
    if (eventToEmit) {
      emitDBUpdate(eventToEmit, data);
    }

    res.json({
      message: "✅ Data saved & broadcasted",
      collection,
    });
  } catch (err) {
    console.error("❌ Insert error:", err);
    res.status(500).json({ error: "Database insertion failed" });
  }
});

// ================= DYNAMIC GET ROUTES =================
const collections = [
  "tournament",
  "upcomingscrim",
  "upcomingtournament",
  "leaderboard",
  "winner",
  "tournamentdetail",
  "joinmatches",
];

collections.forEach((col) => {
  app.get(`/${col}`, ensureDB, async (_, res) => {
    try {
      const data = await db.collection(col).find({}).toArray();
      res.json(data);
    } catch (err) {
      console.error(`❌ Fetch error (${col})`, err);
      res.status(500).json({ error: `Fetch failed for ${col}` });
    }
  });
});

// ================= SERVER START =================
server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
