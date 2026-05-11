import { prisma } from "../src/lib/prisma.ts";

async function main() {
    const cargoId = 19;
    const allQuestions = await prisma.question.findMany({
      where: { isActive: true },
      include: { cargos: true, options: true },
    });
    
    const relevant = allQuestions.filter(q => q.cargos.some(qc => qc.cargoId === cargoId));
    
    console.log("Frequencies:");
    const freqCounts: any = {};
    for (const q of relevant) {
       freqCounts[q.frequencyType] = (freqCounts[q.frequencyType] || 0) + 1;
    }
    console.log(freqCounts);
}

main().finally(() => prisma.$disconnect());
