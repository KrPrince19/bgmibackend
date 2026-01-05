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

/* ================= SERVER ================= */
const server = http.createServer(app);

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"], 
});

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

/* ================= EMIT HELPER ================= */
const emitDBUpdate = (event, payload = null) => {
  console.log("📡 SOCKET EMIT:", event);
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

/* ---------------- INSERT LOGIC ---------------- */
app.post("/tournament", async (req, res) => {
  const { collection, data } = req.body;

  if (!collection || !Array.isArray(data)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    await db.collection(collection).insertMany(data);

    // 🔥 Trigger socket events based on which collection was updated
    if (collection === "tournament" || collection === "upcomingtournament") {
      emitDBUpdate("TOURNAMENT_ADDED", data);
    }

    if (collection === "joinmatches") {
      emitDBUpdate("JOIN_MATCH", data);
    }

    if (collection === "upcomingscrim") {
      emitDBUpdate("UPCOMING_SCRIM_ADDED", data);
    }

    if (collection === "winner") {
      emitDBUpdate("WINNER_UPDATED", data);
    }

    if (collection === "leaderboard") {
      emitDBUpdate("LEADERBOARD_UPDATED", data);
    }

    res.json({ message: "Saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

/* ---------------- GET ROUTES ---------------- */
const get = (path, col) =>
  app.get(path, async (_, res) => {
    try {
      const data = await db.collection(col).find({}).toArray();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Fetch error" });
    }
  });

get("/tournament", "tournament");
get("/upcomingscrim", "upcomingscrim");
get("/upcomingtournament", "upcomingtournament");
get("/leaderboard", "leaderboard");
get("/winner", "winner");
get("/tournamentdetail", "tournamentdetail");
get("/joinmatches", "joinmatches");

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
