import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { authMiddleware, AuthRequest } from "../middleware/auth.ts";

const router = Router();

// GET /api/eval-categories — todas las categorías
router.get("/", authMiddleware, async (_req, res) => {
  try {
    const cats = await prisma.autoEvalCategory.findMany({
      orderBy: { order: "asc" },
    });
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener categorías" });
  }
});

// POST /api/eval-categories — crear categoría (admin)
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins" });
    }
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }
    const cat = await prisma.autoEvalCategory.create({
      data: { name: name.trim().toUpperCase() },
    });
    res.json(cat);
  } catch (error) {
    res.status(500).json({ error: "Error al crear categoría" });
  }
});

// PUT /api/eval-categories/:id — editar categoría (admin)
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins" });
    }
    const id = parseInt(req.params.id as string);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }
    const cat = await prisma.autoEvalCategory.update({
      where: { id },
      data: { name: name.trim().toUpperCase() },
    });
    res.json(cat);
  } catch (error) {
    res.status(500).json({ error: "Error al editar categoría" });
  }
});

// DELETE /api/eval-categories/:id — eliminar categoría (admin)
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins" });
    }
    const id = parseInt(req.params.id as string);
    await prisma.autoEvalCategory.delete({ where: { id } });
    res.json({ message: "Categoría eliminada" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar categoría" });
  }
});

export default router;
