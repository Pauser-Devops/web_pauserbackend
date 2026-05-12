import { prisma } from "../src/lib/prisma.ts";
async function main() {
    const evaluations = await prisma.evaluation.findMany();
    console.log("Total evaluations:", evaluations.length);
    console.log("Evaluations with completedAt:", evaluations.filter(e => e.completedAt !== null).length);
    console.log("Evaluation 0 completedAt:", evaluations[0]?.completedAt);
    console.log("Evaluation 0 isComplete:", evaluations[0]?.isComplete);
}
main().finally(() => prisma.$disconnect());
