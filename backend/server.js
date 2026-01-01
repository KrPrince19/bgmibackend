const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const Admin = require("./models/Admin");
const Joinmatch = require("./models/Joinmatch");

const app = express();
const PORT = process.env.PORT || 5000;

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

/* ================= HTTP + SOCKET ================= */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

/* ================= SOCKET EVENTS ================= */
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

/* ================= MONGODB ================= */
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on("error", (error) =>
  console.error("❌ MongoDB Connection Error:", error)
);

db.once("open", () =>
  console.log("✅ Connected to MongoDB")
);

/* ================= SOCKET EMIT HELPER ================= */
const emitDBUpdate = (event, payload) => {
  io.emit("db-update", {
    event,
    payload,
    time: new Date()
  });
};

/* ------------------------ Join Match ------------------------ */
app.post("/joinmatches", async (req, res) => {
  try {
    const {
      tournamentName,
      firstPlayer,
      secondPlayer,
      thirdPlayer,
      fourthPlayer,
      playerEmail,
      playerMobileNumber,
    } = req.body;

    /* ---------- BASIC VALIDATION ---------- */
    if (
      !tournamentName ||
      !firstPlayer ||
      !secondPlayer ||
      !thirdPlayer ||
      !fourthPlayer ||
      !playerEmail ||
      !playerMobileNumber
    ) {
      return res.status(400).json({
        error: "❌ All fields are required.",
      });
    }

    /* ---------- MOBILE VALIDATION ---------- */
    if (!/^\d{10}$/.test(playerMobileNumber)) {
      return res.status(400).json({
        error: "❌ Mobile number must be exactly 10 digits.",
      });
    }

    /* ---------- DUPLICATE CHECK ---------- */
    const existingUser = await Joinmatch.findOne({
      playerEmail: playerEmail.trim().toLowerCase(),
      tournamentName,
    });

    if (existingUser) {
      return res.status(409).json({
        error: "❌ You have already joined this tournament.",
      });
    }

    /* ---------- SAVE JOIN MATCH ---------- */
    const newJoinmatch = new Joinmatch({
      tournamentName,
      firstPlayer,
      secondPlayer,
      thirdPlayer,
      fourthPlayer,
      playerEmail: playerEmail.trim().toLowerCase(),
      playerMobileNumber,
    });

    await newJoinmatch.save();

    // 🔥 REAL-TIME SOCKET UPDATE
    emitDBUpdate("JOIN_MATCH", newJoinmatch);

    return res.status(201).json({
      message: "✅ Joined successfully.",
    });

  } catch (err) {
    console.error("❌ Error saving joinmatch:", err);
    return res.status(500).json({
      error: "❌ Server error while joining.",
    });
  }
});

/* ------------------------ Insert Tournament ------------------------ */
app.post("/tournament", async (req, res) => {
  const { collection, data } = req.body;

  if (!collection || !Array.isArray(data)) {
    return res.status(400).json({
      error: "❌ Invalid request format. Expecting { collection, data[] }",
    });
  }

  try {
    const targetCollection = db.collection(collection);
    await targetCollection.insertMany(data);

    // 🔥 REAL-TIME SOCKET UPDATE
    emitDBUpdate("TOURNAMENT_ADDED", data);

    res.status(201).json({ message: "✅ Data saved successfully." });
  } catch (err) {
    console.error("❌ DB error:", err);
    res.status(500).json({ error: "❌ Failed to save data." });
  }
});

/* ------------------------ Get Data Routes ------------------------ */
const createGetRoute = (path, collectionName) => {
  app.get(path, async (req, res) => {
    try {
      const data = await db.collection(collectionName).find({}).toArray();
      res.json(data);
    } catch (err) {
      console.error(`❌ Error fetching ${collectionName}:`, err);
      res.status(500).json({ error: `❌ Failed to fetch ${collectionName}.` });
    }
  });
};

// get data from DB
createGetRoute("/tournament", "tournament");
createGetRoute("/leaderboard", "leaderboard");
createGetRoute("/upcomingscrim", "upcomingscrim");
createGetRoute("/upcomingtournament", "upcomingtournament");
createGetRoute("/winner", "winner");
createGetRoute("/tournamentdetail", "tournamentdetail");
createGetRoute("/joinmatches", "joinmatches");

/* ================= START SERVER ================= */
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
