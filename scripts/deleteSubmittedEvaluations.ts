import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 15000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function deleteSubmittedEvaluations() {
  console.log("Counting ALL evaluations (submitted + drafts)...");

  const count = await prisma.evaluation.count();

  console.log(`Found ${count} evaluations to delete.`);

  if (count === 0) {
    console.log("Nothing to delete. Exiting.");
    await prisma.$disconnect();
    return;
  }

  console.log("Deleting in order to respect FK constraints...\n");

  // 1. Delete AnswerApproval records
  const approvals = await prisma.answerApproval.deleteMany({
    where: { answer: { evaluation: {} } },
  });
  console.log(`  Deleted ${approvals.count} AnswerApproval records`);

  // 2. Delete AnswerDelegation records
  const delegations = await prisma.answerDelegation.deleteMany({
    where: { answer: { evaluation: {} } },
  });
  console.log(`  Deleted ${delegations.count} AnswerDelegation records`);

  // 3. Delete EvaluationAnswerSelector records
  const selectors = await prisma.evaluationAnswerSelector.deleteMany({
    where: { answer: { evaluation: {} } },
  });
  console.log(`  Deleted ${selectors.count} EvaluationAnswerSelector records`);

  // 4. Delete AnswerFile records
  const files = await prisma.answerFile.deleteMany({
    where: { answer: { evaluation: {} } },
  });
  console.log(`  Deleted ${files.count} AnswerFile records`);

  // 5. Get all evaluations to delete related QuestionSubmissions
  const allEvals = await prisma.evaluation.findMany({
    select: { id: true, campaignId: true, userId: true },
  });

  // Delete QuestionSubmissions for those user+campaign combos
  let submissionCount = 0;
  for (const ev of allEvals) {
    const result = await prisma.questionSubmission.deleteMany({
      where: { userId: ev.userId, campaignId: ev.campaignId },
    });
    submissionCount += result.count;
  }
  console.log(`  Deleted ${submissionCount} QuestionSubmission records`);

  // 6. Delete Answer records
  const answers = await prisma.answer.deleteMany({
    where: { evaluation: {} },
  });
  console.log(`  Deleted ${answers.count} Answer records`);

  // 7. Delete ALL Evaluation records
  const evaluations = await prisma.evaluation.deleteMany();
  console.log(`  Deleted ${evaluations.count} Evaluation records`);

  console.log("\nDone. ALL evaluations (submitted + drafts) have been deleted.");
  await prisma.$disconnect();
}

deleteSubmittedEvaluations().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
