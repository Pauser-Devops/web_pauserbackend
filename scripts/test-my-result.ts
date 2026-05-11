import { prisma } from "../src/lib/prisma.ts";

async function main() {
    const userId = 17;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let campaign = await prisma.campaign.findFirst({
      where: {
        isActive: true,
        startDate: { lte: todayEnd },
        endDate: { gte: today },
      },
      orderBy: { startDate: "desc" },
    });

    if (!campaign) {
      campaign = await prisma.campaign.findFirst({
        where: { isActive: true, endDate: { lt: today } },
        orderBy: { endDate: "desc" },
      });
    }

    console.log("Found campaign in my-result:", campaign?.id);

    if (campaign) {
      const evaluation = await prisma.evaluation.findFirst({
        where: { userId, campaignId: campaign.id, source: "EXCELENCIA", programId: null },
      });
      console.log("Evaluation found in my-result:", evaluation?.id);
    }
}

main().finally(() => prisma.$disconnect());
