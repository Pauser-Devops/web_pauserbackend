import { prisma } from "../src/lib/prisma.ts";

async function main() {
  // 1. Delete all question submissions (not cascaded from evaluations)
  const subs = await prisma.questionSubmission.deleteMany({});
  console.log(`Question submissions deleted: ${subs.count}`);

  // 2. Delete evaluations (cascades to answers, answerFiles, answerDelegations, answerApprovals, evaluationAnswerSelectors)
  const evals = await prisma.evaluation.deleteMany({
    where: { source: "EXCELENCIA" },
  });
  console.log(`Evaluations (EXCELENCIA) deleted: ${evals.count}`);

  // 3. Clean localStorage drafts reminder
  console.log("\nHecho. Recordá que los usuarios deben limpiar localStorage:");
  console.log(`  - Abrir DevTools (F12) > Application > Local Storage`);
  console.log(`  - Eliminar claves que comiencen con "pauser_answers_draft_"`);
  console.log(`  - O cerrar sesión y volver a entrar (el submit limpia el draft)`);
}

main()
  .then(() => { process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
