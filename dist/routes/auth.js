"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_ts_1 = require("../lib/prisma.ts");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
router.post("/register", async (req, res) => {
    try {
        const { email, password, roleId = 2, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email y password son requeridos" });
        }
        const existingUser = await prisma_ts_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "El email ya está registrado" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_ts_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                roleId,
            },
            include: { role: true },
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, roleId: user.roleId, cargoId: user.cargoId }, JWT_SECRET, { expiresIn: "7d" });
        res.status(201).json({
            message: "Usuario creado exitosamente",
            token,
            user: { id: user.id, email: user.email, roleId: user.roleId, roleName: user.role.name, name: user.name, cargoId: user.cargoId },
        });
    }
    catch (error) {
        console.error("Error en register:", error);
        res.status(500).json({ error: "Error al crear usuario" });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email y password son requeridos" });
        }
        const user = await prisma_ts_1.prisma.user.findUnique({
            where: { email },
            include: {
                role: true,
                sede: true,
                unidadNegocio: true,
                cargo: true,
            },
        });
        if (!user) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }
        const validPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, roleId: user.roleId, cargoId: user.cargoId }, JWT_SECRET, { expiresIn: "7d" });
        res.json({
            message: "Login exitoso",
            token,
            user: {
                id: user.id,
                email: user.email,
                roleId: user.roleId,
                roleName: user.role.name,
                name: user.name,
                sede: user.sede,
                unidadNegocio: user.unidadNegocio,
                cargo: user.cargo,
                cargoId: user.cargoId,
            },
        });
    }
    catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: "Error en el login" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map