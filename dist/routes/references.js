"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_ts_1 = require("../lib/prisma.ts");
const auth_ts_1 = require("../middleware/auth.ts");
const frequency_ts_1 = require("../utils/frequency.ts");
const router = (0, express_1.Router)();
// Sedes
router.get("/sedes", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const sedes = await prisma_ts_1.prisma.sede.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
        res.json(sedes);
    }
    catch (error) {
        res.status(500).json({ error: "Error al listar sedes" });
    }
});
router.post("/sedes", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        const sede = await prisma_ts_1.prisma.sede.create({ data: req.body });
        res.json(sede);
    }
    catch (error) {
        res.status(500).json({ error: "Error al crear sede" });
    }
});
router.put("/sedes/:id", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        const sede = await prisma_ts_1.prisma.sede.update({ where: { id: (0, frequency_ts_1.parseId)(req.params.id) }, data: req.body });
        res.json(sede);
    }
    catch (error) {
        res.status(500).json({ error: "Error al actualizar sede" });
    }
});
router.delete("/sedes/:id", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        await prisma_ts_1.prisma.sede.update({ where: { id: (0, frequency_ts_1.parseId)(req.params.id) }, data: { isActive: false } });
        res.json({ message: "Sede desactivada" });
    }
    catch (error) {
        res.status(500).json({ error: "Error al eliminar sede" });
    }
});
// Unidades de Negocio
router.get("/unidades", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const unidades = await prisma_ts_1.prisma.unidadNegocio.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
        res.json(unidades);
    }
    catch (error) {
        res.status(500).json({ error: "Error al listar unidades" });
    }
});
router.post("/unidades", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        const unidad = await prisma_ts_1.prisma.unidadNegocio.create({ data: req.body });
        res.json(unidad);
    }
    catch (error) {
        res.status(500).json({ error: "Error al crear unidad" });
    }
});
router.put("/unidades/:id", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        const unidad = await prisma_ts_1.prisma.unidadNegocio.update({ where: { id: (0, frequency_ts_1.parseId)(req.params.id) }, data: req.body });
        res.json(unidad);
    }
    catch (error) {
        res.status(500).json({ error: "Error al actualizar unidad" });
    }
});
router.delete("/unidades/:id", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        await prisma_ts_1.prisma.unidadNegocio.update({ where: { id: (0, frequency_ts_1.parseId)(req.params.id) }, data: { isActive: false } });
        res.json({ message: "Unidad desactivada" });
    }
    catch (error) {
        res.status(500).json({ error: "Error al eliminar unidad" });
    }
});
// Cargos
router.get("/cargos", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const cargos = await prisma_ts_1.prisma.cargo.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
        res.json(cargos);
    }
    catch (error) {
        res.status(500).json({ error: "Error al listar cargos" });
    }
});
router.post("/cargos", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        const cargo = await prisma_ts_1.prisma.cargo.create({ data: req.body });
        res.json(cargo);
    }
    catch (error) {
        res.status(500).json({ error: "Error al crear cargo" });
    }
});
router.put("/cargos/:id", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        const cargo = await prisma_ts_1.prisma.cargo.update({ where: { id: (0, frequency_ts_1.parseId)(req.params.id) }, data: req.body });
        res.json(cargo);
    }
    catch (error) {
        res.status(500).json({ error: "Error al actualizar cargo" });
    }
});
router.delete("/cargos/:id", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1)
            return res.status(403).json({ error: "Solo admins" });
        await prisma_ts_1.prisma.cargo.update({ where: { id: (0, frequency_ts_1.parseId)(req.params.id) }, data: { isActive: false } });
        res.json({ message: "Cargo desactivado" });
    }
    catch (error) {
        res.status(500).json({ error: "Error al eliminar cargo" });
    }
});
exports.default = router;
//# sourceMappingURL=references.js.map