import { prisma } from "../src/lib/prisma.ts";

async function main() {
    const cargoId = 19;
    const allQuestions = await prisma.question.findMany({
      where: { isActive: true },
      include: { cargos: true, options: true },
    });
    
    const relevant = allQuestions.filter(q => q.cargos.some(qc => qc.cargoId === cargoId));
    const noOptions = relevant.filter(q => !q.options || q.options.length === 0);
    console.log("Relevant with NO options:", noOptions.map(q => q.id));
}

main().finally(() => prisma.$disconnect());
