import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const evals = await prisma.evaluation.findMany({
    where: { userId: 17 },
    include: { campaign: true },
    orderBy: { createdAt: "desc" },
    take: 3
  });
  console.log(JSON.stringify(evals, null, 2));
}

main().finally(() => prisma.$disconnect());
