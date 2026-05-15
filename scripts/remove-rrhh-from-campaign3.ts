/**
 * remove-rrhh-from-campaign3.ts
 *
 * Elimina las preguntas Q#48-Q#64 de la campaña #3 (Autoevaluación Mes de Abril)
 * y recalcula el maxScore de las evaluaciones afectadas.
 *
 * Run: npx tsx scripts/remove-rrhh-from-campaign3.ts
 *
 * ⚠️  Solo ejecutar si esas preguntas NO debían estar en la campaña de Abril.
 */
import { prisma } from "../src/lib/prisma.ts";

const CAMPAIGN_ID = 3;
const QUESTIONS_TO_REMOVE = [48, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64];

async function main() {
  console.log(`🔧 Campaña #${CAMPAIGN_ID} — Removiendo preguntas genéricas RRHH...\n`);

  // 1. Verificar cuántas asignaciones hay
  const existing = await prisma.campaignQuestion.findMany({
    where: { campaignId: CAMPAIGN_ID, questionId: { in: QUESTIONS_TO_REMOVE } },
  });
  console.log(`Asignaciones encontradas para eliminar: ${existing.length}`);
  if (existing.length === 0) {
    console.log("Nada que eliminar.");
    return;
  }

  // 2. Eliminar las asignaciones (CampaignQuestion) — NO borra las preguntas
  const deleted = await prisma.campaignQuestion.deleteMany({
    where: { campaignId: CAMPAIGN_ID, questionId: { in: QUESTIONS_TO_REMOVE } },
  });
  console.log(`✅ Eliminadas ${deleted.count} asignaciones de CampaignQuestion.\n`);

  // 3. Recalcular maxScore para las evaluaciones de esta campaña
  const allQuestions = await prisma.question.findMany({
    where: { isActive: true },
    include: { cargos: true, options: true },
  });

  const remainingCampaignQs = await prisma.campaignQuestion.findMany({
    where: { campaignId: CAMPAIGN_ID },
    select: { questionId: true },
  });
  const remainingIds = new Set(remainingCampaignQs.map(cq => cq.questionId));

  const evaluations = await prisma.evaluation.findMany({
    where: { campaignId: CAMPAIGN_ID, source: "EXCELENCIA" },
    include: { user: { select: { name: true, cargoId: true } } },
  });

  for (const ev of evaluations) {
    const userCargoId = ev.user.cargoId;
    const relevantQuestions = allQuestions.filter(q => {
      if (!remainingIds.has(q.id)) return false; // solo preguntas que quedan en la campaña
      if (q.cargos.length === 0) return true;
      return q.cargos.some(qc => qc.cargoId === userCargoId);
    });

    const newMaxScore = relevantQuestions.reduce((sum, q) => {
      return sum + (q.options.length > 0 ? Math.max(...q.options.map(o => o.score || 0)) : 0);
    }, 0);

    console.log(`Eval#${ev.id} | ${ev.user.name} | maxScore: ${ev.maxScore} → ${newMaxScore}`);
    await prisma.evaluation.update({
      where: { id: ev.id },
      data: { maxScore: newMaxScore },
    });
  }

  console.log("\n✅ maxScore recalculado para todas las evaluaciones de la campaña #3.");
  console.log("Las preguntas Q#48-Q#64 siguen existiendo y disponibles para otras campañas.");
}

main()
  .catch(e => { console.error("ERROR:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
