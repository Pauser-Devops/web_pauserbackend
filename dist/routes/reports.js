"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_ts_1 = require("../lib/prisma.ts");
const auth_ts_1 = require("../middleware/auth.ts");
const router = (0, express_1.Router)();
// GET /api/reports/monthly-comparison?month=2026-04&userId=X (admin) o solo month (user ve propio)
router.get("/monthly-comparison", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const { month, userId } = req.query;
        const currentUserId = req.user.id;
        const isAdmin = req.user.roleId === 1;
        // month formato: "2026-04"
        if (!month || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ error: "month debe tener formato YYYY-MM" });
        }
        const [year, monthNum] = month.split("-").map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59);
        const targetUserId = isAdmin && userId ? parseInt(userId) : currentUserId;
        // Obtener evaluaciones de ambos sources para el usuario en el mes
        const evaluations = await prisma_ts_1.prisma.evaluation.findMany({
            where: {
                userId: targetUserId,
                completedAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                campaign: { select: { id: true, name: true } },
                answers: {
                    include: {
                        question: {
                            include: {
                                options: true,
                                configs: true,
                            },
                        },
                        option: true,
                        files: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        const excelenciaEval = evaluations.find(e => e.source === "EXCELENCIA");
        const misProgramasEval = evaluations.find(e => e.source === "MIS_PROGRAMAS");
        // Helper: recalculate maxScore based on current questions for user's cargo
        const recalcMaxScore = async (evaluation) => {
            if (!evaluation)
                return 0;
            const campaignId = evaluation.campaignId;
            const campaignQuestions = await prisma_ts_1.prisma.campaignQuestion.findMany({
                where: { campaignId },
                select: { questionId: true },
            });
            const campaignQuestionIds = campaignQuestions.map(cq => cq.questionId);
            const allQuestions = await prisma_ts_1.prisma.question.findMany({
                where: {
                    isActive: true,
                    ...(campaignQuestionIds.length > 0 && { id: { in: campaignQuestionIds } }),
                },
                include: { cargos: true, options: true },
            });
            const userData = await prisma_ts_1.prisma.user.findUnique({ where: { id: targetUserId }, select: { cargoId: true } });
            const relevantQuestions = allQuestions.filter((q) => {
                if (q.cargos.length === 0)
                    return true;
                return q.cargos.some((qc) => qc.cargoId === userData?.cargoId);
            });
            return relevantQuestions.reduce((sum, q) => {
                return sum + (q.options?.length > 0 ? Math.max(...q.options.map(o => o.score || 0)) : 0);
            }, 0);
        };
        const [excelenciaMaxScore, misProgramasMaxScore] = await Promise.all([
            recalcMaxScore(excelenciaEval),
            recalcMaxScore(misProgramasEval),
        ]);
        // Helper: recalculate totalScore from answers using current option scores
        const recalcTotalScore = (evaluation) => {
            if (!evaluation)
                return 0;
            return evaluation.answers.reduce((sum, a) => {
                const optionScore = a.option?.score ?? a.awardedScore ?? 0;
                return sum + optionScore;
            }, 0);
        };
        const excelenciaTotalScore = recalcTotalScore(excelenciaEval);
        const misProgramasTotalScore = recalcTotalScore(misProgramasEval);
        // Obtener detalle por pregunta
        const getQuestionDetails = (evaluation) => {
            if (!evaluation)
                return [];
            return evaluation.answers.map(a => ({
                questionId: a.questionId,
                questionText: a.question.text,
                awardedScore: a.awardedScore,
                optionSelected: a.option?.label || null,
                optionText: a.option?.text || null,
                maxScore: a.question.options.length > 0 ? Math.max(...a.question.options.map(o => o.score)) : 0,
                hasFiles: a.files.length > 0,
                files: a.files.map(f => ({ fileType: f.fileType, fileName: f.fileName })),
            }));
        };
        // Historial mensual (últimos 6 meses)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);
        const monthlyHistory = await prisma_ts_1.prisma.$queryRaw `
      SELECT
        DATE_TRUNC('month', "completedAt") as month,
        source,
        AVG("totalScore") as avg_score,
        AVG("maxScore") as max_score,
        COUNT(*) as count
      FROM "Evaluation"
      WHERE "userId" = ${targetUserId}
        AND "completedAt" IS NOT NULL
        AND "completedAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "completedAt"), source
      ORDER BY month ASC
    `;
        const processedHistory = monthlyHistory.map(row => ({
            ...row,
            count: typeof row.count === 'bigint' ? Number(row.count) : row.count,
            avg_score: typeof row.avg_score === 'bigint' ? Number(row.avg_score) : Number(row.avg_score || 0),
            max_score: typeof row.max_score === 'bigint' ? Number(row.max_score) : Number(row.max_score || 0),
        }));
        // Estadísticas por cargo (admin ve todos, user ve solo su cargo como benchmark)
        const targetUser = await prisma_ts_1.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { cargoId: true, cargo: { select: { name: true } } },
        });
        let cargoStats = null;
        const allEvaluations = await prisma_ts_1.prisma.evaluation.findMany({
            where: {
                completedAt: {
                    gte: startDate,
                    lte: endDate,
                },
                ...(isAdmin ? {} : { user: { cargoId: targetUser?.cargoId || undefined } }),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        cargo: { select: { name: true } },
                    },
                },
            },
        });
        const cargoMap = {};
        allEvaluations.forEach(e => {
            const cargoName = e.user.cargo?.name || "Sin cargo";
            if (!cargoMap[cargoName]) {
                cargoMap[cargoName] = { excelencia: [], misProgramas: [] };
            }
            if (e.source === "EXCELENCIA") {
                cargoMap[cargoName].excelencia.push(e.totalScore);
            }
            else if (e.source === "MIS_PROGRAMAS") {
                cargoMap[cargoName].misProgramas.push(e.totalScore);
            }
        });
        cargoStats = Object.entries(cargoMap).map(([cargo, scores]) => ({
            cargo,
            excelencia: {
                count: scores.excelencia.length,
                avg: scores.excelencia.length > 0 ? Math.round(scores.excelencia.reduce((a, b) => a + b, 0) / scores.excelencia.length) : 0,
            },
            misProgramas: {
                count: scores.misProgramas.length,
                avg: scores.misProgramas.length > 0 ? Math.round(scores.misProgramas.reduce((a, b) => a + b, 0) / scores.misProgramas.length) : 0,
            },
        }));
        res.json({
            month,
            user: {
                id: targetUserId,
                name: excelenciaEval?.user?.name || misProgramasEval?.user?.name || null,
            },
            current: {
                excelencia: excelenciaEval ? {
                    totalScore: excelenciaTotalScore,
                    maxScore: excelenciaMaxScore,
                    percentage: excelenciaMaxScore > 0 ? Math.round((excelenciaTotalScore / excelenciaMaxScore) * 100) : 0,
                    completedAt: excelenciaEval.completedAt,
                    questions: getQuestionDetails(excelenciaEval),
                } : null,
                misProgramas: misProgramasEval ? {
                    totalScore: misProgramasTotalScore,
                    maxScore: misProgramasMaxScore,
                    percentage: misProgramasMaxScore > 0 ? Math.round((misProgramasTotalScore / misProgramasMaxScore) * 100) : 0,
                    completedAt: misProgramasEval.completedAt,
                    questions: getQuestionDetails(misProgramasEval),
                } : null,
            },
            difference: excelenciaEval && misProgramasEval
                ? excelenciaTotalScore - misProgramasTotalScore
                : null,
            history: processedHistory,
            cargoStats,
        });
    }
    catch (error) {
        console.error("Error al obtener comparativa mensual:", error);
        res.status(500).json({ error: error.message || "Error al obtener comparativa mensual" });
    }
});
// GET /api/reports/question-breakdown?month=2026-04&questionId=X
router.get("/question-breakdown", auth_ts_1.authMiddleware, async (req, res) => {
    try {
        const { month, questionId } = req.query;
        if (!month || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ error: "month debe tener formato YYYY-MM" });
        }
        if (!questionId) {
            return res.status(400).json({ error: "Falta questionId" });
        }
        const [year, monthNum] = month.split("-").map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59);
        const qId = parseInt(questionId);
        // Obtener todas las respuestas para esta pregunta en el mes
        const answers = await prisma_ts_1.prisma.answer.findMany({
            where: {
                questionId: qId,
                evaluation: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            },
            include: {
                evaluation: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                cargo: { select: { name: true } },
                            },
                        },
                    },
                },
                question: {
                    include: {
                        options: true,
                    },
                },
                option: true,
                files: true,
            },
        });
        // Agrupar por opción seleccionada
        const optionDistribution = {};
        answers.forEach(a => {
            const optionLabel = a.option?.label || "Sin respuesta";
            if (!optionDistribution[optionLabel]) {
                optionDistribution[optionLabel] = { count: 0, users: [] };
            }
            optionDistribution[optionLabel].count++;
            optionDistribution[optionLabel].users.push(a.evaluation.user.name || a.evaluation.user.email);
        });
        // Distribución por fuente
        const sourceDistribution = answers.reduce((acc, a) => {
            const source = a.evaluation.source;
            if (!acc[source])
                acc[source] = { count: 0, totalScore: 0 };
            acc[source].count++;
            acc[source].totalScore += a.awardedScore;
            return acc;
        }, {});
        // Estadísticas
        const totalAnswers = answers.length;
        const avgScore = totalAnswers > 0 ? Math.round(answers.reduce((sum, a) => sum + a.awardedScore, 0) / totalAnswers) : 0;
        const withFiles = answers.filter(a => a.files.length > 0).length;
        res.json({
            question: {
                id: answers[0]?.question.id,
                text: answers[0]?.question.text,
                options: answers[0]?.question.options || [],
            },
            month,
            totalAnswers,
            avgScore,
            withFiles,
            withoutFiles: totalAnswers - withFiles,
            optionDistribution,
            sourceDistribution,
        });
    }
    catch (error) {
        console.error("Error al obtener detalle por pregunta:", error);
        res.status(500).json({ error: error.message || "Error al obtener detalle por pregunta" });
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map