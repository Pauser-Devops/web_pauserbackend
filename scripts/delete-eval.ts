import { prisma } from "../src/lib/prisma.ts";

async function main() {
  await prisma.evaluation.deleteMany({
    where: { userId: 17, campaignId: 3 }
  });
  console.log("Evaluation deleted successfully");
}

main().finally(() => prisma.$disconnect());
