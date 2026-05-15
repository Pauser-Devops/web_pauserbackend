/**
 * debug-max-score.ts
 * 
 * Diagnóstico: muestra por qué el maxScore da 166 para los usuarios.
 * Run: npx tsx scripts/debug-max-score.ts
 */
import { prisma } from "../src/lib/prisma.ts";

async function main() {
  // 1. Listar preguntas EXCELENCIA/AMBOS con sus puntajes máximos y cargos
  const questions = await prisma.question.findMany({
    where: { isActive: true, targetType: { in: ["EXCELENCIA", "AMBOS"] } },
    include: { cargos: { include: { cargo: true } }, options: true },
    orderBy: { id: "asc" },
  });

  console.log(`\n📋 Total preguntas EXCELENCIA+AMBOS activas: ${questions.length}`);
  let totalMaxScore = 0;
  for (const q of questions) {
    const maxOpt = q.options.length > 0 ? Math.max(...q.options.map(o => o.score || 0)) : 0;
    totalMaxScore += maxOpt;
    const cargosLabel = q.cargos.length === 0
      ? "TODOS LOS CARGOS"
      : q.cargos.map(c => c.cargo.name).join(", ");
    console.log(`  Q#${q.id} | maxOpt=${maxOpt} | cargos=[${cargosLabel}] | "${q.text.slice(0, 50)}"`);
  }
  console.log(`  => SUMA total maxScore: ${totalMaxScore}\n`);

  // 2. Mostrar campañas y sus preguntas asignadas
  const campaigns = await prisma.campaign.findMany({
    include: { questions: { include: { question: true } } },
  });
  for (const camp of campaigns) {
    console.log(`🎯 Campaña #${camp.id}: ${camp.name} | Preguntas asignadas: ${camp.questions.length}`);
    if (camp.questions.length > 0) {
      for (const cq of camp.questions) {
        console.log(`   - Q#${cq.questionId}: ${cq.question.text.slice(0, 50)}`);
      }
    } else {
      console.log("   (Sin preguntas asignadas explícitamente — usa TODAS las activas)");
    }
  }

  // 3. Mostrar evaluaciones y su maxScore actual
  const evals = await prisma.evaluation.findMany({
    where: { source: "EXCELENCIA" },
    include: { user: { select: { name: true, cargoId: true, cargo: { select: { name: true } } } } },
  });
  console.log(`\n📊 Evaluaciones EXCELENCIA:`);
  for (const ev of evals) {
    console.log(`  Eval#${ev.id} | ${ev.user.name} | cargo=${ev.user.cargo?.name} | maxScore=${ev.maxScore} | totalScore=${ev.totalScore}`);
  }
}

main()
  .catch(e => { console.error("ERROR:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
