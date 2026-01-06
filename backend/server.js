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

// ✅ Enhanced CORS for Render
app.use(
  cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"], // Added websocket support
});

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ================= SOCKET HELPER =================
const emitDBUpdate = (event, payload = null) => {
  console.log(`📡 EMIT EVENT → ${event}`);
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

// ================= DB READY GUARD =================
const ensureDBReady = (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({
      error: "⏳ Database not ready, retry in a moment",
    });
  }
  next();
};

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.json({
    status: "Backend running 🚀",
    dbReady,
    time: new Date(),
  });
});

// ================= ADMIN UPLOADER (Generic) =================
app.post("/tournament", ensureDBReady, async (req, res) => {
  const { collection, data } = req.body;

  if (!collection || !data) {
    return res.status(400).json({ error: "❌ Invalid payload" });
  }

  // Convert single object to array if necessary for insertMany
  const dataArray = Array.isArray(data) ? data : [data];

  try {
    await db.collection(collection).insertMany(dataArray);
    console.log(`✅ Inserted into collection: ${collection}`);

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
      emitDBUpdate(eventToEmit, dataArray);
    }

    res.json({ message: "✅ Data saved & broadcasted", collection });
  } catch (err) {
    console.error("❌ Insert error:", err);
    res.status(500).json({ error: "Database insertion failed" });
  }
});

// ================= JOIN MATCH DIRECT ROUTE =================
// This handles the frontend's original request directly if preferred
app.post("/joinmatches", ensureDBReady, async (req, res) => {
  try {
    const registrationData = req.body;
    await db.collection("joinmatches").insertOne(registrationData);
    
    emitDBUpdate("JOIN_MATCH", registrationData);
    
    res.status(201).json({ message: "✅ Joined successfully" });
  } catch (err) {
    console.error("❌ Join error:", err);
    res.status(500).json({ error: "Failed to join match" });
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
  app.get(`/${col}`, ensureDBReady, async (req, res) => {
    try {
      const data = await db.collection(col).find({}).toArray();
      res.json(data);
    } catch (err) {
      console.error(`❌ Fetch error (${col}):`, err);
      res.status(500).json({ error: `Fetch failed for ${col}` });
    }
  });
});

// ================= SERVER START =================
server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
