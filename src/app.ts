
import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";

import playersRouter from "./routes/players.js";
import tournamentsRouter from "./routes/tournaments.js";
import participantsRouter from "./routes/participants.js";
import matchesRouter from "./routes/matches.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/players", playersRouter);
app.use("/api/tournaments", tournamentsRouter);
app.use("/api/tournaments/:id/participants", participantsRouter);
app.use("/api/matches", matchesRouter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    application: "CourtPulse",
    message: "CourtPulse API is running",
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
      application: "CourtPulse",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

export default app;
