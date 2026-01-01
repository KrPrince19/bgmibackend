const mongoose = require("mongoose");

const joinmatchSchema = new mongoose.Schema({
  tournamentName: {
    type: String,
    required: true,
    trim: true,
  },
  firstPlayer: {
    type: String,
    required: true,
    trim: true,
  },
  secondPlayer: {
    type: String,
    required: true,
    trim: true,
  },
  thirdPlayer: {
    type: String,
    required: true,
    trim: true,
  },
  fourthPlayer: {
    type: String,
    required: true,
    trim: true,
  },
  playerEmail: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Joinmatch", joinmatchSchema);
