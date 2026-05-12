import { prisma } from "../src/lib/prisma.ts";
async function main() {
    const answers = await prisma.answer.findMany();
    console.log("Total answers:", answers.length);
    const submissions = await prisma.questionSubmission.findMany();
    console.log("Total submissions:", submissions.length);
    const evaluations = await prisma.evaluation.findMany();
    console.log("Total evaluations:", evaluations.length);
}
main().finally(() => prisma.$disconnect());
