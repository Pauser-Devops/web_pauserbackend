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

async function testEvaluationsData() {
  console.log("=".repeat(80));
  console.log("TEST DE DATOS DE EVALUACIONES - DB → BACKEND → FRONTEND");
  console.log("=".repeat(80));
  console.log();

  // 1. Ver todas las evaluaciones en BD
  const evaluations = await prisma.evaluation.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      campaign: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
      answers: {
        include: {
          question: { select: { id: true, text: true } },
          option: { select: { id: true, label: true, score: true } },
          files: true,
          reviewedBy: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Total de evaluaciones en BD: ${evaluations.length}`);
  console.log();

  for (const ev of evaluations) {
    console.log(`--- Evaluación #${ev.id} ---`);
    console.log(`  Usuario: ${ev.user.name || ev.user.email}`);
    console.log(`  Campaña: ${ev.campaign.name}`);
    console.log(`  Source: ${ev.source}`);
    console.log(`  Programa: ${ev.program?.name || "N/A"}`);
    console.log(`  totalScore: ${ev.totalScore}`);
    console.log(`  maxScore: ${ev.maxScore}`);
    console.log(`  completedAt: ${ev.completedAt?.toISOString() || "PENDIENTE"}`);
    console.log(`  adminFinalScore: ${ev.adminFinalScore ?? "NO PUBLICADO"}`);
    console.log(`  adminFinalComment: ${ev.adminFinalComment || "(vacío)"}`);
    console.log(`  adminPublishedAt: ${ev.adminPublishedAt?.toISOString() || "NO PUBLICADO"}`);
    console.log(`  answers count: ${ev.answers.length}`);
    
    // Calcular scores como lo hace el backend
    const autoScore = ev.answers.reduce((sum, a) => sum + (a.awardedScore || 0), 0);
    const adminScore = ev.answers.reduce((sum, a) => sum + (a.adminScore || 0), 0);
    const reviewedCount = ev.answers.filter((a) => a.adminScore !== null).length;
    
    console.log(`  [CALCULADO] autoScore: ${autoScore}, adminScore: ${adminScore}, reviewed: ${reviewedCount}/${ev.answers.length}`);
    
    if (ev.answers.length > 0) {
      console.log("  [RESPUESTAS]");
      for (const a of ev.answers) {
        console.log(`    Answer #${a.id}:`);
        console.log(`      questionId: ${a.questionId}`);
        console.log(`      question.text: ${a.question?.text || "SIN PREGUNTA"}`);
        console.log(`      awardedScore: ${a.awardedScore}`);
        console.log(`      adminScore: ${a.adminScore ?? "SIN REVISAR"}`);
        console.log(`      adminComment: ${a.adminComment || "(vacío)"}`);
        console.log(`      option: ${a.option?.label || "SIN OPCIÓN"}`);
        console.log(`      files: ${a.files.length} archivo(s)`);
        console.log(`      reviewedBy: ${a.reviewedBy?.name || "SIN REVISOR"}`);
      }
    }
    
    console.log();
  }

  console.log("=".repeat(80));
  console.log("VERIFICACIÓN DE PROBLEMAS");
  console.log("=".repeat(80));
  
  // Verificar problemas comunes
  const evalsWithoutAnswers = evaluations.filter(e => e.answers.length === 0);
  const evalsWithoutQuestions = evaluations.filter(e => e.answers.some(a => !a.question));
  const evalsWithoutOptions = evaluations.filter(e => e.answers.some(a => a.optionId && !a.option));
  
  console.log(`  Evaluaciones sin respuestas: ${evalsWithoutAnswers.length}`);
  console.log(`  Evaluaciones con respuestas sin pregunta: ${evalsWithoutQuestions.length}`);
  console.log(`  Evaluaciones con optionId pero sin option: ${evalsWithoutOptions.length}`);
  
  if (evalsWithoutAnswers.length > 0) {
    console.log("  ⚠️ PROBLEMA: Hay evaluaciones sin respuestas asociadas");
    evalsWithoutAnswers.forEach(e => console.log(`    - Eval #${e.id} (${e.user.name || e.user.email})`));
  }
  
  if (evalsWithoutQuestions.length > 0) {
    console.log("  ⚠️ PROBLEMA: Hay respuestas sin pregunta asociada (questionId no existe)");
  }
  
  if (evalsWithoutOptions.length > 0) {
    console.log("  ⚠️ PROBLEMA: Hay respuestas con optionId pero la opción no existe");
  }

  await prisma.$disconnect();
}

testEvaluationsData().catch(console.error);
