"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_ts_1 = require("../lib/prisma.ts");
const auth_ts_1 = require("../middleware/auth.ts");
const frequency_ts_1 = require("../utils/frequency.ts");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path_1.default.join(process.cwd(), "uploads");
        if (!fs_1.default.existsSync(uploadPath))
            fs_1.default.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage });
const router = (0, express_1.Router)();
async function recomputeEvaluationProgress(evaluationId) {
    const evaluation = await prisma_ts_1.prisma.evaluation.findUnique({
        where: { id: evaluationId },
        include: {
            user: { select: { cargoId: true } },
            program: { select: { id: true } },
            campaign: { select: { id: true } },
            answers: {
                where: { status: { in: ["ANSWERED", "COMPLETED"] } },
                include: { question: { include: { configs: true, cargos: true } } }
            }
        }
    });
    if (!evaluation)
        throw new Error("Evaluation not found");
    const userCargoId = evaluation.user.cargoId;
    const programId = evaluation.program?.id;
    const now = new Date();
    let relevantQuestions = [];
    if (programId) {
        const qps = await prisma_ts_1.prisma.questionProgram.findMany({
            where: { programId },
            select: { questionId: true }
        });
        const questionIds = qps.map(qp => qp.questionId);
        relevantQuestions = await prisma_ts_1.prisma.question.findMany({
            where: { id: { in: questionIds }, isActive: true },
            include: { configs: true, cargos: true }
        });
    }
    else {
        relevantQuestions = await prisma_ts_1.prisma.question.findMany({
            where: {
                cargos: { some: { cargoId: userCargoId || 0 } },
                targetType: { in: ["EXCELENCIA", "AMBOS"] },
                isActive: true
            },
            include: { configs: true, cargos: true }
        });
    }
    let expected = 0;
    let answered = 0;
    for (const q of relevantQuestions) {
        const { periodStart } = (0, frequency_ts_1.getCurrentPeriod)(q.frequencyType, q.frequencyDay, q.frequencyInterval, now);
        if (periodStart > now)
            continue;
        expected += 1;
        const answer = evaluation.answers.find(a => a.questionId === q.id && a.periodStart?.getTime() === periodStart.getTime());
        if (answer && (answer.status === "ANSWERED" || answer.status === "COMPLETED")) {
            answered += 1;
        }
    }
    const percentage = expected > 0 ? Math.round((answered / expected) * 100) : 0;
    const hasPending = evaluation.answers.some(a => a.status === "PENDING_DELEGATION" || a.status === "PENDING_APPROVAL");
    const isComplete = answered === expected && !hasPending;
    await prisma_ts_1.prisma.evaluation.update({
        where: { id: evaluationId },
        data: { completedAt: isComplete ? now : null }
    });
    return { answered, expected, percentage, isComplete };
}
router.get("/my-pending", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.cargoId) {
            return res.json([]);
        }
        const delegations = await prisma_ts_1.prisma.answerDelegation.findMany({
            where: {
                status: "PENDIENTE",
                trigger: {
                    delegateCargoId: user.cargoId,
                },
            },
            include: {
                answer: {
                    include: {
                        question: true,
                        evaluation: {
                            include: {
                                program: true,
                            },
                        },
                    },
                },
                trigger: {
                    include: {
                        delegateCargo: true,
                        triggerOption: true,
                    },
                },
                completedBy: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { deadlineAt: "asc" },
        });
        res.json(delegations);
    }
    catch (error) {
        console.error("Error delegations/my-pending:", error);
        res.status(500).json({ error: "Error al obtener delegaciones" });
    }
});
router.get("/visibility", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.cargoId) {
            return res.json({ visible: false });
        }
        const count = await prisma_ts_1.prisma.answerDelegation.count({
            where: {
                status: "PENDIENTE",
                trigger: {
                    delegateCargoId: user.cargoId,
                },
            },
        });
        res.json({ visible: count > 0 });
    }
    catch (error) {
        res.status(500).json({ error: "Error" });
    }
});
router.get("/all", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1) {
            return res.status(403).json({ error: "Solo admins" });
        }
        const { status, questionId } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (questionId)
            where.answer = { questionId: (0, frequency_ts_1.parseId)(questionId) };
        const delegations = await prisma_ts_1.prisma.answerDelegation.findMany({
            where,
            include: {
                answer: {
                    include: {
                        question: true,
                        evaluation: {
                            include: {
                                user: { select: { id: true, name: true, email: true } },
                                program: true,
                            },
                        },
                    },
                },
                trigger: {
                    include: {
                        delegateCargo: true,
                        triggerOption: true,
                    },
                },
                completedBy: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { deadlineAt: "desc" },
            take: 100,
        });
        res.json(delegations);
    }
    catch (error) {
        res.status(500).json({ error: "Error al obtener delegaciones" });
    }
});
router.post("/:id/upload", auth_ts_1.authMiddleware, upload.single("file"), async (req, res) => {
    try {
        const delegationId = (0, frequency_ts_1.parseId)(req.params.id);
        const user = req.user;
        const delegation = await prisma_ts_1.prisma.answerDelegation.findUnique({
            where: { id: delegationId },
            include: {
                answer: {
                    include: {
                        question: { include: { flowConfig: true } },
                        evaluation: { select: { id: true, programId: true } }
                    }
                },
                trigger: {
                    include: {
                        delegateCargo: true,
                    },
                },
            },
        });
        if (!delegation) {
            return res.status(404).json({ error: "Delegación no encontrada" });
        }
        if (user?.cargoId !== delegation.trigger.delegateCargoId && user?.roleId !== 1) {
            return res.status(403).json({ error: "No tienes permiso" });
        }
        if (delegation.status !== "PENDIENTE") {
            return res.status(400).json({ error: "La delegación no está pendiente" });
        }
        const fileUrl = req.file ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` : null;
        if (req.file) {
            await prisma_ts_1.prisma.answerFile.create({
                data: {
                    answerId: delegation.answerId,
                    fileType: delegation.trigger.secondFileType,
                    fileName: req.file.originalname,
                    fileUrl,
                    phase: "DELEGATE",
                    uploadedByUserId: user.id,
                },
            });
        }
        const isLate = new Date() > delegation.deadlineAt;
        await prisma_ts_1.prisma.answerDelegation.update({
            where: { id: delegationId },
            data: {
                status: "COMPLETADO",
                completedAt: new Date(),
                completedByUserId: user.id,
                isLate,
            },
        });
        const answerApproval = await prisma_ts_1.prisma.answerApproval.findUnique({
            where: { answerId: delegation.answerId }
        });
        if (answerApproval && answerApproval.status === "PENDIENTE") {
            await prisma_ts_1.prisma.answer.update({
                where: { id: delegation.answerId },
                data: { status: "PENDING_APPROVAL" }
            });
        }
        else {
            await prisma_ts_1.prisma.answer.update({
                where: { id: delegation.answerId },
                data: { status: "COMPLETED", completedAt: new Date() }
            });
        }
        await recomputeEvaluationProgress(delegation.answer.evaluation.id);
        res.json({
            message: "Delegación completada",
            isLate,
        });
    }
    catch (error) {
        console.error("Error delegation upload:", error);
        res.status(500).json({ error: "Error al subir archivos" });
    }
});
router.put("/:id/cancel", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        if (req.user?.roleId !== 1) {
            return res.status(403).json({ error: "Solo admins" });
        }
        const delegationId = (0, frequency_ts_1.parseId)(req.params.id);
        await prisma_ts_1.prisma.answerDelegation.update({
            where: { id: delegationId },
            data: {
                status: "CANCELADA",
                cancelledAt: new Date(),
            },
        });
        res.json({ message: "Delegación cancelada" });
    }
    catch (error) {
        res.status(500).json({ error: "Error al cancelar" });
    }
});
exports.default = router;
//# sourceMappingURL=delegations.js.map