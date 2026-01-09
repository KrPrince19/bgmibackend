"use client";

import { useParams } from "next/navigation";
import React, { useEffect, useState, useCallback } from "react";
import { socket } from "../../../lib/socket";
import { Trophy, Swords, User, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PassedDetailPage() {
  const params = useParams();

  // Logic matches DetailPage: State is an array of all matches
  const [passedMatches, setPassedMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ================= FETCH DATA (FULL LIST LOGIC) ================= */
  const fetchPassedMatches = useCallback(async () => {
    try {
      // Logic matches DetailPage: Fetches the whole collection list
      const res = await fetch(
        "https://bgmibackendzm.onrender.com/passedmatch", 
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);

      const data = await res.json();
      setPassedMatches(data); 
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch match results.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    fetchPassedMatches();
  }, [fetchPassedMatches]);

  /* ================= SOCKET.IO LISTENER ================= */
  useEffect(() => {
    const handler = (data) => {
      // Matches DetailPage realtime update logic
      if (data.event === "PASSED_MATCH_ADDED") {
        fetchPassedMatches(); 
      }
    };

    socket.on("db-update", handler);
    return () => socket.off("db-update", handler);
  }, [fetchPassedMatches]);

  /* ================= FRONTEND FIND LOGIC (Same as DetailPage) ================= */
  const match = passedMatches.find(
    (m) => String(m.tournamentId).trim() === String(params.id).trim()
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center mt-20">
        <p className="text-red-500 text-xl font-bold">{error}</p>
        <Link href="/" className="text-cyan-600 underline mt-4 inline-block font-bold">Go Back</Link>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center mt-20">
        <p className="text-red-500 text-xl font-bold">Match results not found.</p>
        <p className="text-slate-400 mt-2">Checking for ID: {params.id}</p>
        <Link href="/" className="text-cyan-600 underline mt-4 inline-block font-bold">Go Back</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden border">
        
        {/* HEADER SECTION */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 text-center text-white relative">
          <Link href="/" className="absolute left-6 top-8 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-wider">
            {(match.matchName || "Match Results").toUpperCase()}
          </h1>
          <p className="text-slate-400 mt-2 font-mono">Tournament ID: {match.tournamentId}</p>
        </div>

        <div className="p-6 md:p-10">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Swords className="text-cyan-500" /> Player Performance
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((num) => (
              <PlayerCard 
                key={num}
                name={match[`player${num}_name`]}
                kills={match[`player${num}_kill`]}
                points={match[`player${num}_point`]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PlayerCard = ({ name, kills, points }) => {
  if (!name) return null;
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600">
          <User size={20} />
        </div>
        <p className="text-lg font-bold text-slate-800">{name}</p>
      </div>
      <div className="flex gap-3">
        <StatBox label="Kills" value={kills} color="text-red-500" />
        <StatBox label="Points" value={points} color="text-blue-500" />
      </div>
    </div>
  );
};

const StatBox = ({ label, value, color }) => (
  <div className="bg-white px-3 py-1 rounded-lg border text-center min-w-[60px]">
    <p className={`text-[10px] uppercase font-bold ${color}`}>{label}</p>
    <p className="text-lg font-black text-slate-800">{value || 0}</p>
  </div>
);
