
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Admin = require("./models/Admin");
const Joinmatch = require("./models/Joinmatch");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb+srv://py242340_db_user:7VeSyeJ9ApvZzAYQ@cluster0.j0zpvjb.mongodb.net/bgmi", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", (error) => console.error("❌ MongoDB Connection Error:", error));
db.once("open", () => console.log("✅ Connected to MongoDB"));

/* ------------------------ Admin Registration ------------------------ */
app.post("/admins", async (req, res) => {
  const { name, email, password, adminId } = req.body;

  if (!name || !email || !password || !adminId) {
    return res.status(400).json({ error: "❌ Name, email, password, and adminId are required." });
  }

  // Log for debugging (remove or disable in production)
  console.log("Received adminId from client:", JSON.stringify(adminId));
  console.log("process.env.ADMIN_ID:", JSON.stringify(process.env.ADMIN_ID));

  const validAdminId = process.env.ADMIN_ID;
  if (!validAdminId) {
    console.error("❌ ADMIN_ID is not set in environment");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  // Normalize both sides: trim and toString
  const submitted = String(adminId).trim();
  const valid = String(validAdminId).trim();

  if (submitted !== valid) {
    console.log("❌ Admin ID mismatch:", { submitted, valid });
    return res
      .status(403)
      .json({ error: "Invalid admin ID. Registration not allowed." });
  }

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ error: "❌ Admin already exists. Please log in." });
    }

    const newAdmin = new Admin({
      name,
      email,
      password,  // in a real app, hash the password before saving!
      isVerified: true,
    });
    await newAdmin.save();

    res.status(201).json({ message: "✅ Admin registered successfully." });
  } catch (err) {
    console.error("❌ Error saving admin:", err);
    res.status(500).json({ error: "❌ Server error while saving admin." });
  }
});


/* ------------------------ Join Match ------------------------ */
app.post("/joinmatches", async (req, res) => {
  try {
    const {
      tournamentName,
      firstPlayer,
      secondPlayer,
      thirdPlayer,
      forthPlayer,
      playerEmail,
      playerPassword,
      playerConfirmPassword,
      playerMobileNumber,
    } = req.body;

    if (
      !tournamentName ||
      !firstPlayer ||
      !secondPlayer ||
      !thirdPlayer ||
      !forthPlayer ||
      !playerEmail ||
      !playerPassword ||
      !playerConfirmPassword ||
      !playerMobileNumber
    ) {
      return res.status(400).json({ error: "❌ All fields are required." });
    }

    if (playerPassword !== playerConfirmPassword) {
      return res.status(400).json({ error: "❌ Passwords do not match." });
    }

    // ✅ Check for duplicate entry (same email + tournament)
    const existingUser = await Joinmatch.findOne({
      playerEmail,
      tournamentName,
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "❌ You have already joined this tournament." });
    }

    const newJoinmatch = new Joinmatch({
      tournamentName,
      firstPlayer,
      secondPlayer,
      thirdPlayer,
      forthPlayer,
      playerEmail,
      playerPassword,
      playerMobileNumber,
    });

    await newJoinmatch.save();
    res.status(201).json({ message: "✅ Joined successfully." });
  } catch (err) {
    console.error("❌ Error saving joinmatch:", err);
    res.status(500).json({ error: "❌ Server error while joining." });
  }
});

/* ------------------------ Admin Login ------------------------ */
app.post("/adminlogin", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "❌ Email and password are required." });
  }

  try {
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json({ error: "❌ Admin not found. Please sign up." });
    }

    if (admin.password !== password) {
      return res.status(401).json({ error: "❌ Invalid credentials." });
    }

    admin.isVerified = true;
    await admin.save();

    res.status(200).json({
      message: "✅ Login successful",
      admin: {
        name: admin.name,
        email: admin.email,
        adminId: admin.adminId,
      },
    });
  } catch (err) {
    console.error("❌ Admin login error:", err);
    res.status(500).json({ error: "❌ Server error during login." });
  }
});

/* ------------------------ Admin Logout ------------------------ */
app.post("/logoutadmin", async (req, res) => {
  const { email } = req.body;

  try {
    const admin = await Admin.findOneAndUpdate(
      { email },
      { isVerified: false },
      { new: true }
    );

    if (!admin) {
      return res.status(404).json({ error: "❌ Admin not found." });
    }

    res.json({ message: "✅ Admin logged out successfully." });
  } catch (err) {
    console.error("❌ Logout error:", err);
    res.status(500).json({ error: "❌ Failed to log out admin." });
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

//get data from DB
createGetRoute("/tournament", "tournament");
createGetRoute("/mvpplayer", "mvpplayer");
createGetRoute("/rank", "rank");
createGetRoute("/upcomingscrim", "upcomingscrim");
createGetRoute("/upcomingtournament", "upcomingtournament");
createGetRoute("/topplayer", "topplayer");
createGetRoute("/tournamentdetail", "tournamentdetail");
createGetRoute("/admins", "admins");
createGetRoute("/joinmatches", "joinmatches");


/* ------------------------ Start Server ------------------------ */
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
