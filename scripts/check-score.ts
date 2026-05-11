import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const allQs = await prisma.question.findMany({ include: { options: true } });
  console.log("Total qs:", allQs.length);
  let maxScore = 0;
  for(const q of allQs) {
    if (q.options && q.options.length > 0) {
       maxScore += Math.max(...q.options.map((o: any) => o.score || 0));
    }
  }
  console.log("Global maxScore:", maxScore);
}

main().finally(() => prisma.$disconnect());
