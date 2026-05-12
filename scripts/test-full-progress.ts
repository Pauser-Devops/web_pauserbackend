import { prisma } from "../src/lib/prisma.ts";

async function main() {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        let campaign = await prisma.campaign.findFirst({
            where: { isActive: true, startDate: { lte: todayEnd }, endDate: { gte: today } },
            orderBy: { startDate: "desc" },
        });

        if (!campaign) {
            campaign = await prisma.campaign.findFirst({
              where: { isActive: true },
              orderBy: { startDate: "desc" },
            });
        }

        if (!campaign) {
            console.log("No campaign");
            return;
        }

        const assignedUsers = await prisma.campaignUser.findMany({
            where: { campaignId: campaign.id },
            include: { user: { select: { id: true, name: true, email: true, cargoId: true, cargo: { select: { name: true } } } } },
        });

        const campaignQuestions = await prisma.campaignQuestion.findMany({
            where: { campaignId: campaign.id },
            select: { questionId: true },
        });
        const campaignQuestionIds = campaignQuestions.map((cq: any) => cq.questionId);

        const allQuestions = await prisma.question.findMany({
            where: {
                isActive: true,
                ...(campaignQuestionIds.length > 0 && { id: { in: campaignQuestionIds } }),
            },
            include: { configs: true, cargos: true },
        });

        const allSubmissions = await prisma.questionSubmission.findMany({
            where: { campaignId: campaign.id },
        });

        const allEvaluations = await prisma.evaluation.findMany({
            where: { campaignId: campaign.id, source: "EXCELENCIA" },
        });

        console.log("Success! Campaign:", campaign.name);
    } catch (e) {
        console.error("ERROR:", e);
    }
}

main().finally(() => prisma.$disconnect());
