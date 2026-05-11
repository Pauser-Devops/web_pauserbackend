import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const qs = await prisma.question.findMany({
    where: { id: { in: [24, 25, 26, 27, 28] } },
    include: { options: true, selectors: true }
  });
  console.log(JSON.stringify(qs, null, 2));
}

main().finally(() => prisma.$disconnect());
