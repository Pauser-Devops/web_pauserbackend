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
    
    // Check evaluation 10 details
    const evalRes = await client.query(`
      SELECT e.id, e."campaignId", e."userId", e.source, e."totalScore", e."maxScore", e."completedAt",
             u.name as user_name, c.name as campaign_name
      FROM "Evaluation" e
      JOIN "User" u ON u.id = e."userId"
      LEFT JOIN "Campaign" c ON c.id = e."campaignId"
      WHERE e.id = 10
    `);
    console.log("📋 Evaluación 10:", evalRes.rows[0]);
    
    // Check ALL evaluations for Teran (userId 17)
    const allEvalsRes = await client.query(`
      SELECT e.id, e."campaignId", e.source, e."totalScore", e."maxScore", e."completedAt",
             c.name as campaign_name
      FROM "Evaluation" e
      LEFT JOIN "Campaign" c ON c.id = e."campaignId"
      WHERE e."userId" = 17
      ORDER BY e."createdAt" DESC
    `);
    console.log("\n📋 Todas las evaluaciones de Teran:");
    for (const e of allEvalsRes.rows) {
      console.log(`   Eval ${e.id}: Campaña ${e.campaignId} (${e.campaign_name}) | Score: ${e.totalScore}/${e.maxScore} | completedAt: ${e.completedAt ? 'SÍ' : 'NO'}`);
    }
    
    // Check answers for evaluation 10
    const answersRes = await client.query(`
      SELECT a.id, a."questionId", a."optionId", a."awardedScore",
             o.label as option_label, o.score as option_score
      FROM "Answer" a
      LEFT JOIN "QuestionOption" o ON o.id = a."optionId"
      WHERE a."evaluationId" = 10
      ORDER BY a.id
    `);
    console.log(`\n📝 Respuestas en Eval 10 (${answersRes.rows.length} respuestas):`);
    for (const a of answersRes.rows) {
      console.log(`   Answer ${a.id}: Q${a.questionId} | optionId=${a.optionId} | option_label=${a.option_label} | score=${a.option_score ?? 0} | awardedScore=${a.awardedScore}`);
    }
    
    // Check if there are ANY answers in the entire DB for campaign 4
    const campAnswersRes = await client.query(`
      SELECT COUNT(*) as count
      FROM "Answer" a
      JOIN "Evaluation" e ON e.id = a."evaluationId"
      WHERE e."campaignId" = 4
    `);
    console.log(`\n📊 Total respuestas en Campaña 4: ${campAnswersRes.rows[0].count}`);
    
    // Check evaluations in campaign 4
    const campEvalsRes = await client.query(`
      SELECT e.id, e."userId", u.name as user_name, e."totalScore", e."completedAt"
      FROM "Evaluation" e
      JOIN "User" u ON u.id = e."userId"
      WHERE e."campaignId" = 4
      ORDER BY e."createdAt" DESC
    `);
    console.log(`\n📋 Evaluaciones en Campaña 4 (${campEvalsRes.rows.length}):`);
    for (const e of campEvalsRes.rows) {
      console.log(`   Eval ${e.id}: ${e.user_name} | Score: ${e.totalScore} | completedAt: ${e.completedAt ? 'SÍ' : 'NO'}`);
    }
    
    client.release();
    await pool.end();
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }
})();
