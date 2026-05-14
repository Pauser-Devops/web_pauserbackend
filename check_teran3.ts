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
    
    // Check ALL answers for campaign 4
    const allAnswersRes = await client.query(`
      SELECT a."questionId", a."optionId", a."awardedScore",
             e."userId", u.name as user_name,
             o.label as option_label, o.score as option_score,
             e."completedAt"
      FROM "Answer" a
      JOIN "Evaluation" e ON e.id = a."evaluationId"
      JOIN "User" u ON u.id = e."userId"
      LEFT JOIN "QuestionOption" o ON o.id = a."optionId"
      WHERE e."campaignId" = 4
      ORDER BY a."questionId", e."userId"
    `);
    
    console.log("📋 TODAS las respuestas en Campaña 4:");
    console.log("=".repeat(80));
    
    const byQuestion = {};
    for (const row of allAnswersRes.rows) {
      if (!byQuestion[row.questionId]) byQuestion[row.questionId] = [];
      byQuestion[row.questionId].push(row);
    }
    
    console.log(`Total preguntas con respuestas: ${Object.keys(byQuestion).length}`);
    console.log(`Total respuestas: ${allAnswersRes.rows.length}`);
    
    for (const [qId, answers] of Object.entries(byQuestion)) {
      console.log(`\n❓ Pregunta ${qId}:`);
      for (const a of answers) {
        console.log(`   👤 ${a.user_name} (ID:${a.userId}) → ${a.option_label || 'SIN OPCIÓN (null)'} (${a.option_score || 0} pts) | awardedScore: ${a.awardedScore} | completedAt: ${a.completedAt ? 'SÍ' : 'NO'}`);
      }
    }
    
    // Check campaign details
    const campRes = await client.query(`
      SELECT id, name, "startDate", "endDate", "isActive"
      FROM "Campaign"
      WHERE id = 4
    `);
    console.log("\n📅 Campaña:", campRes.rows[0]);
    
    // Check campaign questions
    const cqRes = await client.query(`
      SELECT cq."questionId", q.text
      FROM "CampaignQuestion" cq
      JOIN "Question" q ON q.id = cq."questionId"
      WHERE cq."campaignId" = 4
      ORDER BY cq."questionId"
    `);
    console.log("\n📋 Preguntas asignadas a campaña 4:");
    for (const cq of cqRes.rows) {
      console.log(`   Q${cq.questionId}: ${cq.text?.substring(0, 60)}...`);
    }
    
    client.release();
    await pool.end();
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }
})();
