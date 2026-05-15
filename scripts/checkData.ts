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

async function checkData() {
  const evalCount = await prisma.evaluation.count();
  const submittedCount = await prisma.evaluation.count({ where: { completedAt: { not: null } } });
  const draftCount = await prisma.evaluation.count({ where: { completedAt: null } });
  const answerCount = await prisma.answer.count();

  console.log(`Total evaluations: ${evalCount}`);
  console.log(`  Submitted: ${submittedCount}`);
  console.log(`  Drafts: ${draftCount}`);
  console.log(`Total answers: ${answerCount}`);

  if (evalCount > 0) {
    const evals = await prisma.evaluation.findMany({ take: 5, include: { user: { select: { id: true, name: true, email: true } }, campaign: { select: { id: true, name: true } } } });
    console.log("\nSample evaluations:");
    evals.forEach(e => {
      console.log(`  ID=${e.id} userId=${e.userId} (${e.user.name || e.user.email}) source=${e.source} totalScore=${e.totalScore} maxScore=${e.maxScore} completedAt=${e.completedAt}`);
    });
  }

  await prisma.$disconnect();
}

checkData().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
