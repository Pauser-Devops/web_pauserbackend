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
    
    // Teran's evaluation
    const evalId = 10;
    const campaignId = 4; // From previous query
    
    // Get all answers from group members for this campaign
    const groupAnswersRes = await client.query(`
      SELECT a.id, a."questionId", a."optionId", a."awardedScore",
             e."userId", u.name as user_name,
             q.text as question_text,
             o.label as option_label, o.score as option_score,
             e."completedAt"
      FROM "Answer" a
      JOIN "Evaluation" e ON e.id = a."evaluationId"
      JOIN "User" u ON u.id = e."userId"
      LEFT JOIN "Question" q ON q.id = a."questionId"
      LEFT JOIN "QuestionOption" o ON o.id = a."optionId"
      WHERE e."campaignId" = $1 AND e."userId" IN (28, 29, 31, 33, 34, 10)
      ORDER BY a."questionId", e."userId"
    `, [campaignId]);
    
    console.log("📋 Respuestas de otros usuarios del grupo (Campaña", campaignId, "):");
    console.log("=".repeat(80));
    
    const byQuestion = {};
    for (const row of groupAnswersRes.rows) {
      if (!byQuestion[row.questionId]) byQuestion[row.questionId] = [];
      byQuestion[row.questionId].push(row);
    }
    
    for (const [qId, answers] of Object.entries(byQuestion)) {
      console.log(`\n❓ Pregunta ${qId}:`);
      for (const a of answers) {
        console.log(`   👤 ${a.user_name} (ID:${a.userId}) → ${a.option_label || 'SIN OPCIÓN'} (${a.option_score || 0} pts) | awardedScore: ${a.awardedScore} | completedAt: ${a.completedAt ? 'SÍ' : 'NO'}`);
      }
    }
    
    // Now check Teran's answers specifically
    console.log("\n\n📋 Comparación directa - Teran vs Grupo:");
    console.log("=".repeat(80));
    
    const teranAnswersRes = await client.query(`
      SELECT a."questionId", a."optionId", a."awardedScore",
             o.label as option_label, o.score as option_score
      FROM "Answer" a
      LEFT JOIN "QuestionOption" o ON o.id = a."optionId"
      WHERE a."evaluationId" = $1
      ORDER BY a."questionId"
    `, [evalId]);
    
    for (const ta of teranAnswersRes.rows) {
      const groupForQ = byQuestion[ta.questionId] || [];
      const hasGroupAnswer = groupForQ.some(g => g.optionId !== null);
      const groupUser = groupForQ.find(g => g.optionId !== null);
      
      console.log(`\nQ${ta.questionId}:`);
      console.log(`   Teran: optionId=${ta.optionId}, option_label=${ta.option_label}, score=${ta.option_score ?? 0}`);
      if (groupUser) {
        console.log(`   Grupo: ${groupUser.user_name} respondió "${groupUser.option_label}" (${groupUser.option_score} pts)`);
      } else {
        console.log(`   Grupo: Sin respuesta con opción`);
      }
    }
    
    client.release();
    await pool.end();
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }
})();
