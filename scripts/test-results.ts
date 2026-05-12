import { prisma } from "../src/lib/prisma.ts";
async function main() {
    const evaluations = await prisma.evaluation.findMany({
      where: { completedAt: { not: null } },
      include: {
        user: { select: { id: true, name: true, email: true, cargoId: true } },
        campaign: { select: { id: true, name: true } },
        answers: { include: { files: true } },
      },
      orderBy: { totalScore: "desc" },
    });
    console.log("Evaluations:", evaluations.length);
}
main().finally(() => prisma.$disconnect());
