import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const client = await pool.connect();
    
    // Check ALL answers in Campaign 3
    const campAnswersRes = await client.query(`
      SELECT a.id, a."questionId", a."optionId", a."awardedScore",
             e."userId", u.name as user_name,
             o.label as option_label, o.score as option_score,
             e."completedAt"
      FROM "Answer" a
      JOIN "Evaluation" e ON e.id = a."evaluationId"
      JOIN "User" u ON u.id = e."userId"
      LEFT JOIN "QuestionOption" o ON o.id = a."optionId"
      WHERE e."campaignId" = 3
      ORDER BY a."questionId", e."userId"
    `);
    
    console.log("📋 TODAS las respuestas en Campaña 3 (Autoevaluación Abril):");
    console.log("=".repeat(80));
    console.log(`Total respuestas: ${campAnswersRes.rows.length}`);
    
    const byQuestion = {};
    for (const row of campAnswersRes.rows) {
      if (!byQuestion[row.questionId]) byQuestion[row.questionId] = [];
      byQuestion[row.questionId].push(row);
    }
    
    console.log(`Preguntas con respuestas: ${Object.keys(byQuestion).length}`);
    
    for (const [qId, answers] of Object.entries(byQuestion)) {
      console.log(`\n❓ Pregunta ${qId}:`);
      for (const a of answers) {
        console.log(`   👤 ${a.user_name} (ID:${a.userId}) → ${a.option_label || 'SIN OPCIÓN (null)'} (${a.option_score || 0} pts) | awardedScore: ${a.awardedScore} | completedAt: ${a.completedAt ? 'SÍ' : 'NO'}`);
      }
    }
    
    // Check Teran's group members answers in Campaign 3
    console.log("\n\n👥 Respuestas de usuarios del mismo grupo que Teran (sede=2, unidad=14) en Campaña 3:");
    const groupAnswersRes = await client.query(`
      SELECT a."questionId", a."optionId", a."awardedScore",
             e."userId", u.name as user_name,
             o.label as option_label, o.score as option_score
      FROM "Answer" a
      JOIN "Evaluation" e ON e.id = a."evaluationId"
      JOIN "User" u ON u.id = e."userId"
      LEFT JOIN "QuestionOption" o ON o.id = a."optionId"
      WHERE e."campaignId" = 3 
        AND u."sedeId" = 2 
        AND u."unidadId" = 14
        AND a."optionId" IS NOT NULL
      ORDER BY a."questionId"
    `);
    
    if (groupAnswersRes.rows.length === 0) {
      console.log("   ❌ NINGÚN usuario del grupo tiene respuestas con opción seleccionada en Campaña 3");
    } else {
      for (const a of groupAnswersRes.rows) {
        console.log(`   👤 ${a.user_name} → Q${a.questionId}: ${a.option_label} (${a.option_score} pts)`);
      }
    }
    
    // Check campaign 3 details
    const campRes = await client.query(`
      SELECT id, name, "startDate", "endDate", "isActive"
      FROM "Campaign"
      WHERE id = 3
    `);
    console.log("\n📅 Campaña 3:", campRes.rows[0]);
    
    client.release();
    await pool.end();
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }
})();
