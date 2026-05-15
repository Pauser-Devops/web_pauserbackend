import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const campaignId = 6;

  // Find all evaluations for campaign 6
  const evals = await prisma.evaluation.findMany({
    where: { campaignId },
    include: {
      user: { select: { id: true, name: true, email: true, cargo: { select: { name: true } } } },
      answers: {
        include: {
          question: { select: { id: true, text: true, category: true } },
          option: { select: { id: true, label: true, score: true } },
        },
        orderBy: { questionId: "asc" },
      },
    },
  });

  console.log(`=== Evaluaciones en campaña ${campaignId} ===\n`);

  for (const e of evals) {
    const withOpt = e.answers.filter(a => a.optionId != null);
    const total = withOpt.reduce((s, a) => s + (a.option?.score ?? a.awardedScore ?? 0), 0);

    console.log(`${e.user.name || e.user.email} (${e.user.cargo?.name || "?"})`);
    console.log(`  Eval #${e.id} | source=${e.source} | totalScore=${e.totalScore} | maxScore=${e.maxScore} | completed=${e.completedAt?.toISOString() || "NO"}`);
    console.log(`  Answers: ${e.answers.length} total, ${withOpt.length} con opción seleccionada`);
    console.log(`  Suma real de scores: ${total}`);
    console.log();

    for (const a of e.answers) {
      const sc = a.option?.score ?? a.awardedScore ?? 0;
      console.log(`    Q${a.questionId} "${a.question.text}" → optId=${a.optionId} "${a.option?.label || "null"}" score=${sc}`);
    }
    console.log();
  }

  // Also check questionSubmission table
  const subs = await prisma.questionSubmission.findMany({
    where: { campaignId },
  });
  console.log(`\n=== Submissions en campaña ${campaignId} ===`);
  
  const userIds = [...new Set(subs.map(s => s.userId))];
  for (const uid of userIds) {
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, email: true, cargo: { select: { name: true } } } });
    const userSubs = subs.filter(s => s.userId === uid);
    console.log(`  ${user?.name || user?.email}: ${userSubs.length} submissions, ${[...new Set(userSubs.map(s => s.questionId))].length} preguntas únicas`);
  }
}

main()
  .then(() => { process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
