import { prisma } from "../src/lib/prisma.ts";

async function main() {
    const userId = 17;
    const campaignId = 3;
    const source = "EXCELENCIA";

    const evaluation = await prisma.evaluation.findFirst({
      where: { userId, campaignId, source, programId: null },
    });
    console.log("Evaluation:", evaluation?.id);
}

main().finally(() => prisma.$disconnect());
