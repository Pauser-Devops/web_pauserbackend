import { prisma } from "../src/lib/prisma.ts";

async function main() {
    const cargoId = 19;
    const allQuestions = await prisma.question.findMany({
      where: { isActive: true },
      include: { cargos: true, options: true },
    });
    
    const relevant = allQuestions.filter(q => q.cargos.some(qc => qc.cargoId === cargoId) || q.cargos.length === 0);
    console.log("Total relevant in system:", relevant.length);

    const maxSystem = relevant.reduce((sum, q) => {
      const maxOpt = q.options?.length ? Math.max(...q.options.map(o => o.score || 0)) : 0;
      return sum + maxOpt;
    }, 0);
    console.log("Max score for system:", maxSystem);
}

main().finally(() => prisma.$disconnect());
