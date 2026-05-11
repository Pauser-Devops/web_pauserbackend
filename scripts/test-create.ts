import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const payload = {
    userId: 17,
    campaignId: 3,
    source: "EXCELENCIA",
    programId: null,
    totalScore: 0,
    maxScore: 24,
    completedAt: new Date()
  };
  try {
     const created = await prisma.evaluation.create({ data: payload });
     console.log("Created successfully:", created.id);
  } catch (err: any) {
     console.log("Error creating evaluation:", err.message);
  }
}

main().finally(() => prisma.$disconnect());
