import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const evals = await prisma.evaluation.findMany({
    include: { answers: true },
    orderBy: { createdAt: "desc" },
    take: 1
  });
  console.log(JSON.stringify(evals, null, 2));
}

main().finally(() => prisma.$disconnect());
