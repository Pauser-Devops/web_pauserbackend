import { prisma } from "../src/lib/prisma.ts";

async function main() {
    const userId = 17;
    const userCargoId = 5; // Replace with user 17's actual cargoId

    const campaign = await prisma.campaign.findFirst({
      where: { id: 3 },
    });
    
    if (!campaign) {
       console.log("No campaign found");
       return;
    }

    const campaignQuestions = await prisma.campaignQuestion.findMany({
      where: { campaignId: campaign.id },
      select: { questionId: true },
    });
    const campaignQuestionIds = campaignQuestions.map((cq: any) => cq.questionId);

    console.log("Campaign Question IDs:", campaignQuestionIds);

    const allQuestions = await prisma.question.findMany({
      where: { 
        isActive: true,
        ...(campaignQuestionIds.length > 0 && { id: { in: campaignQuestionIds } })
      },
      include: { 
        cargos: true,
        options: true,
        selectors: true,
      },
    });

    console.log("Fetched Questions Count:", allQuestions.length);

    const relevantQuestions = allQuestions.filter((q) => {
      if (q.cargos.length === 0) return true; // sin cargo = visible para todos
      return q.cargos.some((qc: any) => qc.cargoId === userCargoId);
    });

    console.log("Relevant Questions Count:", relevantQuestions.length);

    const currentMaxScore = relevantQuestions.reduce((sum, q) => {
      const maxOptionScore = (q as any).options?.length > 0 
        ? Math.max(...(q as any).options.map((opt: any) => opt.score || 0))
        : 0;
      return sum + maxOptionScore;
    }, 0);

    console.log("Calculated currentMaxScore:", currentMaxScore);
}

main().finally(() => prisma.$disconnect());
