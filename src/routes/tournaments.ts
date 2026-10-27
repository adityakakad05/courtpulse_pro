
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

const router = Router();

const createTournamentSchema = z.object({
  name: z.string().trim().min(3).max(100),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(
  (data) =>
    !data.startDate ||
    !data.endDate ||
    new Date(data.endDate) >= new Date(data.startDate),
  {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  },
);

router.get("/", async (_req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            participants: true,
            matches: true,
          },
        },
      },
    });

    res.json({ data: tournaments });
  } catch (error) {
    console.error("List tournaments failed:", error);
    res.status(500).json({ error: "Unable to retrieve tournaments" });
  }
});

router.post("/", async (req, res) => {
  const result = createTournamentSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Invalid tournament data",
      details: result.error.issues,
    });
    return;
  }

  try {
    const tournament = await prisma.tournament.create({
      data: {
        name: result.data.name,
        startDate: result.data.startDate
          ? new Date(result.data.startDate)
          : undefined,
        endDate: result.data.endDate
          ? new Date(result.data.endDate)
          : undefined,
      },
    });

    res.status(201).json({ data: tournament });
  } catch (error) {
    console.error("Create tournament failed:", error);
    res.status(500).json({ error: "Unable to create tournament" });
  }
});

export default router;
