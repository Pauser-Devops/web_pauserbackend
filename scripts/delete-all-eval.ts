import { prisma } from "../src/lib/prisma.ts";

async function main() {
  await prisma.questionSubmission.deleteMany({
    where: { userId: 17, campaignId: 3 }
  });
  await prisma.evaluation.deleteMany({
    where: { userId: 17, campaignId: 3 }
  });
  console.log("Deleted submissions and evaluations successfully");
}

main().finally(() => prisma.$disconnect());
