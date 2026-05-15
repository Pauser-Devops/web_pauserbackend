/**
 * debug-campaign3-supervisor.ts
 *
 * Diagnóstico específico: calcula el maxScore correcto para SUPERVISOR DE OPERACIONES
 * en la campaña #3, mostrando cada pregunta aplicable y su puntaje máximo.
 *
 * Run: npx tsx scripts/debug-campaign3-supervisor.ts
 */
import { prisma } from "../src/lib/prisma.ts";

async function main() {
  // Campaña #3
  const campaign = await prisma.campaign.findUnique({
    where: { id: 3 },
    include: { questions: { include: { question: { include: { cargos: { include: { cargo: true } }, options: true } } } } },
  });

  if (!campaign) { console.log("Campaña #3 no encontrada"); return; }

  console.log(`\n🎯 Campaña: ${campaign.name} (#${campaign.id})`);
  console.log(`   Total preguntas asignadas: ${campaign.questions.length}\n`);

  // Cargo SUPERVISOR DE OPERACIONES
  const supCargo = await prisma.cargo.findFirst({ where: { name: { contains: "SUPERVISOR DE OPERACIONES" } } });
  console.log(`🧑 Cargo buscado: SUPERVISOR DE OPERACIONES => id=${supCargo?.id}`);

  let maxScoreForSup = 0;
  for (const cq of campaign.questions) {
    const q = cq.question;
    const maxOpt = q.options.length > 0 ? Math.max(...q.options.map(o => o.score || 0)) : 0;
    const appliesToSup = q.cargos.length === 0 || q.cargos.some(c => c.cargoId === supCargo?.id);
    if (appliesToSup) {
      maxScoreForSup += maxOpt;
      const cargosLabel = q.cargos.length === 0 ? "TODOS" : q.cargos.map(c => c.cargo.name).join(", ");
      console.log(`  ✅ Q#${q.id} | maxOpt=${maxOpt} | [${cargosLabel}] | "${q.text.slice(0, 55)}"`);
    } else {
      const cargosLabel = q.cargos.map(c => c.cargo.name).join(", ");
      console.log(`  ❌ Q#${q.id} | (skip) | [${cargosLabel}] | "${q.text.slice(0, 55)}"`);
    }
  }
  console.log(`\n  => maxScore correcto para SUPERVISOR DE OPERACIONES en campaña #3: ${maxScoreForSup}`);
  console.log(`  => Actual en DB: 166\n`);
}

main()
  .catch(e => { console.error("ERROR:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
