
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

const router = Router();

const createPlayerSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

router.get("/", async (_req, res) => {
  try {
    const players = await prisma.player.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: players });
  } catch (error) {
    console.error("List players failed:", error);
    res.status(500).json({ error: "Unable to retrieve players" });
  }
});

router.post("/", async (req, res) => {
  const result = createPlayerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Invalid player data",
      details: result.error.issues,
    });
    return;
  }

  try {
    const player = await prisma.player.create({
      data: { name: result.data.name },
    });

    res.status(201).json({ data: player });
  } catch (error) {
    console.error("Create player failed:", error);
    res.status(500).json({ error: "Unable to create player" });
  }
});

export default router;
