import { prisma } from "../src/lib/prisma.ts";

async function main() {
    const user = await prisma.user.findUnique({ where: { id: 17 }});
    console.log("User cargoId:", user?.cargoId);

    const campaignQuestions = await prisma.campaignQuestion.findMany({
      where: { campaignId: 3 },
      select: { questionId: true },
    });
    const campaignQuestionIds = campaignQuestions.map((cq: any) => cq.questionId);

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

    const relevantQuestions = allQuestions.filter((q) => {
      return q.cargos.some((qc: any) => qc.cargoId === user?.cargoId);
    });

    const currentMaxScore = relevantQuestions.reduce((sum, q) => {
      const maxOptionScore = (q as any).options?.length > 0 
        ? Math.max(...(q as any).options.map((opt: any) => opt.score || 0))
        : 0;
      return sum + maxOptionScore;
    }, 0);

    console.log("Calculated currentMaxScore:", currentMaxScore);
}

main().finally(() => prisma.$disconnect());
