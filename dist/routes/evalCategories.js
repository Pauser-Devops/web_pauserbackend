"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_ts_1 = require("../lib/prisma.ts");
const auth_ts_1 = require("../middleware/auth.ts");
const router = (0, express_1.Router)();
// GET /api/eval-categories — todas las categorías
router.get("/", auth_ts_1.authMiddleware, async (_req, res) => {
    try {
        const cats = await prisma_ts_1.prisma.autoEvalCategory.findMany({
            orderBy: { order: "asc" },
        });
        res.json(cats);
    }
    catch (error) {
        res.status(500).json({ error: "Error al obtener categorías" });
    }
});
// POST /api/eval-categories — crear categoría (admin)
router.post("/", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1) {
            return res.status(403).json({ error: "Solo admins" });
        }
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "El nombre es requerido" });
        }
        const cat = await prisma_ts_1.prisma.autoEvalCategory.create({
            data: { name: name.trim().toUpperCase() },
        });
        res.json(cat);
    }
    catch (error) {
        res.status(500).json({ error: "Error al crear categoría" });
    }
});
// PUT /api/eval-categories/:id — editar categoría (admin)
router.put("/:id", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1) {
            return res.status(403).json({ error: "Solo admins" });
        }
        const id = parseInt(req.params.id);
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "El nombre es requerido" });
        }
        const cat = await prisma_ts_1.prisma.autoEvalCategory.update({
            where: { id },
            data: { name: name.trim().toUpperCase() },
        });
        res.json(cat);
    }
    catch (error) {
        res.status(500).json({ error: "Error al editar categoría" });
    }
});
// DELETE /api/eval-categories/:id — eliminar categoría (admin)
router.delete("/:id", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1) {
            return res.status(403).json({ error: "Solo admins" });
        }
        const id = parseInt(req.params.id);
        await prisma_ts_1.prisma.autoEvalCategory.delete({ where: { id } });
        res.json({ message: "Categoría eliminada" });
    }
    catch (error) {
        res.status(500).json({ error: "Error al eliminar categoría" });
    }
});
exports.default = router;
//# sourceMappingURL=evalCategories.js.map