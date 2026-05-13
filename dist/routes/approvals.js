"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_ts_1 = require("../lib/prisma.ts");
const auth_ts_1 = require("../middleware/auth.ts");
const frequency_ts_1 = require("../utils/frequency.ts");
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
        const approvals = await prisma_ts_1.prisma.answerApproval.findMany({
            where: {
                status: "PENDIENTE",
                approverCargoId: user.cargoId,
            },
            include: {
                answer: {
                    include: {
                        question: true,
                        option: true,
                        evaluation: {
                            include: {
                                user: { select: { id: true, name: true, email: true } },
                                program: true,
                            },
                        },
                        files: {
                            where: { phase: "RESPONDER" },
                        },
                    },
                },
                approverCargo: true,
                decidedBy: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(approvals);
    }
    catch (error) {
        console.error("Error approvals/my-pending:", error);
        res.status(500).json({ error: "Error al obtener aprobaciones" });
    }
});
router.get("/visibility", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.cargoId) {
            return res.json({ visible: false });
        }
        const count = await prisma_ts_1.prisma.answerApproval.count({
            where: {
                status: "PENDIENTE",
                approverCargoId: user.cargoId,
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
        const approvals = await prisma_ts_1.prisma.answerApproval.findMany({
            where,
            include: {
                answer: {
                    include: {
                        question: true,
                        option: true,
                        evaluation: {
                            include: {
                                user: { select: { id: true, name: true, email: true } },
                                program: true,
                            },
                        },
                        files: true,
                    },
                },
                approverCargo: true,
                decidedBy: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        res.json(approvals);
    }
    catch (error) {
        res.status(500).json({ error: "Error al obtener aprobaciones" });
    }
});
router.post("/:id/decide", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const approvalId = (0, frequency_ts_1.parseId)(req.params.id);
        const user = req.user;
        const { decision, comment } = req.body;
        if (!user?.cargoId) {
            return res.status(403).json({ error: "Sin cargo asigndo" });
        }
        const approval = await prisma_ts_1.prisma.answerApproval.findUnique({
            where: { id: approvalId },
        });
        if (!approval) {
            return res.status(404).json({ error: "Aprobación no encontrada" });
        }
        if (user.cargoId !== approval.approverCargoId && user.roleId !== 1) {
            return res.status(403).json({ error: "No tienes permiso para aprobar" });
        }
        if (!["APROBADA", "RECHAZADA"].includes(decision)) {
            return res.status(400).json({ error: "Decisión inválida" });
        }
        await prisma_ts_1.prisma.answerApproval.update({
            where: { id: approvalId },
            data: {
                status: decision,
                decidedAt: new Date(),
                decidedByUserId: user.id,
                comment: comment || null,
            },
        });
        const updatedApproval = await prisma_ts_1.prisma.answerApproval.findUnique({
            where: { id: approvalId },
            include: { answer: { select: { evaluationId: true } } }
        });
        const delegation = await prisma_ts_1.prisma.answerDelegation.findUnique({
            where: { answerId: updatedApproval.answerId }
        });
        if (delegation && delegation.status === "PENDIENTE") {
            await prisma_ts_1.prisma.answer.update({
                where: { id: updatedApproval.answerId },
                data: { status: "PENDING_DELEGATION" }
            });
        }
        else {
            await prisma_ts_1.prisma.answer.update({
                where: { id: updatedApproval.answerId },
                data: { status: "COMPLETED", completedAt: new Date() }
            });
        }
        await recomputeEvaluationProgress(updatedApproval.answer.evaluationId);
        res.json({
            message: `Evaluación ${decision === "APROBADA" ? "aprobada" : "rechazada"}`,
            decision,
        });
    }
    catch (error) {
        console.error("Error approval decide:", error);
        res.status(500).json({ error: "Error al decidir" });
    }
});
exports.default = router;
//# sourceMappingURL=approvals.js.map