
import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

const router = Router({ mergeParams: true });

type TournamentRequest = Request<{ id: string }>;

const registerSchema = z.object({
  playerId: z.string().min(1),
});

router.get("/", async (req, res) => {
  const tournamentId = (req as TournamentRequest).params.id;

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      include: { player: true },
      orderBy: { createdAt: "asc" },
    });

    res.json({ data: participants });
  } catch (error) {
    console.error("List participants failed:", error);
    res.status(500).json({ error: "Unable to retrieve participants" });
  }
});

router.post("/", async (req, res) => {
  const tournamentId = (req as TournamentRequest).params.id;
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Invalid participant data",
      details: result.error.issues,
    });
    return;
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const player = await prisma.player.findUnique({
      where: { id: result.data.playerId },
    });

    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    const participant = await prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        playerId: result.data.playerId,
      },
      include: { player: true },
    });

    res.status(201).json({ data: participant });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({ error: "Player is already registered" });
      return;
    }

    console.error("Register participant failed:", error);
    res.status(500).json({ error: "Unable to register participant" });
  }
});

export default router;
