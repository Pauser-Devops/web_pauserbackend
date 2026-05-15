/**
 * fix-max-score.ts
 * 
 * Corrige el campo maxScore de todas las evaluaciones EXCELENCIA que tengan
 * un valor incorrecto (166 pts en vez del real del cargo del usuario).
 * 
 * Run: npx tsx scripts/fix-max-score.ts
 */
import { prisma } from "../src/lib/prisma.ts";

async function main() {
  console.log("🔧 Iniciando corrección de maxScore...\n");

  // 1. Cargar todas las preguntas EXCELENCIA/AMBOS con sus opciones y cargos
  const allQuestions = await prisma.question.findMany({
    where: { isActive: true, targetType: { in: ["EXCELENCIA", "AMBOS"] } },
    include: { cargos: true, options: true },
  });

  // 2. Cargar mapeo de campaña → preguntas asignadas
  const allCampaignQuestions = await prisma.campaignQuestion.findMany({
    select: { campaignId: true, questionId: true },
  });
  const campaignQMap = new Map<number, Set<number>>();
  for (const cq of allCampaignQuestions) {
    if (!campaignQMap.has(cq.campaignId)) campaignQMap.set(cq.campaignId, new Set());
    campaignQMap.get(cq.campaignId)!.add(cq.questionId);
  }

  // 3. Cargar todas las evaluaciones EXCELENCIA con su usuario
  const evaluations = await prisma.evaluation.findMany({
    where: { source: "EXCELENCIA" },
    include: {
      user: { select: { id: true, name: true, cargoId: true } },
    },
  });

  console.log(`Total evaluaciones EXCELENCIA: ${evaluations.length}`);

  let fixed = 0;
  let alreadyCorrect = 0;

  for (const ev of evaluations) {
    const userCargoId = ev.user.cargoId;
    const campaignQIds = campaignQMap.get(ev.campaignId);

    // Preguntas de la campaña (o todas las EXCELENCIA si no hay asignadas)
    const campaignQuestions = campaignQIds && campaignQIds.size > 0
      ? allQuestions.filter(q => campaignQIds.has(q.id))
      : allQuestions;

    // Filtrar por cargo del usuario
    const relevantQuestions = campaignQuestions.filter(q => {
      if (q.cargos.length === 0) return true;
      return q.cargos.some(qc => qc.cargoId === userCargoId);
    });

    // Calcular maxScore correcto
    const correctMaxScore = relevantQuestions.reduce((sum, q) => {
      return sum + (q.options.length > 0 ? Math.max(...q.options.map(o => o.score || 0)) : 0);
    }, 0);

    if (ev.maxScore !== correctMaxScore) {
      console.log(
        `  ✏️  Eval #${ev.id} | Usuario: ${ev.user.name} | cargoId=${userCargoId}` +
        ` | maxScore: ${ev.maxScore} → ${correctMaxScore}` +
        ` | preguntas relevantes: ${relevantQuestions.length}`
      );
      await prisma.evaluation.update({
        where: { id: ev.id },
        data: { maxScore: correctMaxScore },
      });
      fixed++;
    } else {
      alreadyCorrect++;
    }
  }

  console.log(`\n✅ Listo. Corregidas: ${fixed} | Ya correctas: ${alreadyCorrect}`);
}

main()
  .catch(e => { console.error("ERROR:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
