import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const questions = await prisma.question.findMany({
    orderBy: { id: "asc" },
  });

  console.log(`Found ${questions.length} questions.`);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // Asignar el orden basado en su posición actual (orden de creación/ID)
    const newOrder = i + 1;
    
    if (q.order !== newOrder) {
      await prisma.question.update({
        where: { id: q.id },
        data: { order: newOrder },
      });
      console.log(`Question ID ${q.id} updated: order ${q.order} -> ${newOrder}`);
    }
  }

  console.log("All question orders fixed.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
