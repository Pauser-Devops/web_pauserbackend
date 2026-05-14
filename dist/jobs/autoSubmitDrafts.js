"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoSubmitDrafts = autoSubmitDrafts;
const prisma_ts_1 = require("../lib/prisma.ts");
async function autoSubmitDrafts() {
    console.log("[autoSubmitDrafts] Running...");
    try {
        const now = new Date();
        // Find closed campaigns (inactive OR endDate passed)
        const closedCampaigns = await prisma_ts_1.prisma.campaign.findMany({
            where: {
                OR: [
                    { isActive: false },
                    { endDate: { lt: now } },
                ],
            },
        });
        if (closedCampaigns.length === 0) {
            console.log("[autoSubmitDrafts] No closed campaigns found");
            return 0;
        }
        let submittedCount = 0;
        for (const campaign of closedCampaigns) {
            // Find draft evaluations for this campaign
            const draftEvals = await prisma_ts_1.prisma.evaluation.findMany({
                where: {
                    campaignId: campaign.id,
                    completedAt: null,
                    answers: { some: {} },
                },
                include: { answers: true },
            });
            if (draftEvals.length === 0)
                continue;
            // Get campaign questions for maxScore calculation
            const campaignQuestions = await prisma_ts_1.prisma.campaignQuestion.findMany({
                where: { campaignId: campaign.id },
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
            for (const draftEval of draftEvals) {
                const userData = await prisma_ts_1.prisma.user.findUnique({
                    where: { id: draftEval.userId },
                    select: { cargoId: true },
                });
                const relevantQuestions = allQuestions.filter(q => {
                    if (q.cargos.length === 0)
                        return true;
                    return q.cargos.some(qc => qc.cargoId === userData?.cargoId);
                });
                const currentMaxScore = relevantQuestions.reduce((sum, q) => {
                    return sum + (q.options?.length > 0 ? Math.max(...q.options.map(o => o.score || 0)) : 0);
                }, 0);
                const totalScore = draftEval.answers.reduce((s, a) => {
                    const question = relevantQuestions.find(q => q.id === a.questionId);
                    if (!question)
                        return s;
                    const option = question.options?.find(o => o.id === a.optionId);
                    return s + (option?.score || a.awardedScore || 0);
                }, 0);
                await prisma_ts_1.prisma.evaluation.update({
                    where: { id: draftEval.id },
                    data: { completedAt: now, totalScore, maxScore: currentMaxScore },
                });
                submittedCount++;
                console.log(`[autoSubmitDrafts] Auto-submitted eval ${draftEval.id} for user ${draftEval.userId} (score: ${totalScore}/${currentMaxScore})`);
            }
        }
        console.log(`[autoSubmitDrafts] Submitted ${submittedCount} draft evaluations`);
        return submittedCount;
    }
    catch (error) {
        console.error("[autoSubmitDrafts] Error:", error);
        throw error;
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    autoSubmitDrafts()
        .then((count) => {
        console.log(`Done: ${count} auto-submitted`);
        process.exit(0);
    })
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=autoSubmitDrafts.js.map