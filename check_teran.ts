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
    
    // 1. Buscar usuario Teran
    const userRes = await client.query(`
      SELECT id, email, name, "cargoId", "sedeId", "unidadId" 
      FROM "User" 
      WHERE name ILIKE '%teran%' OR email ILIKE '%teran%'
    `);
    
    if (userRes.rows.length === 0) {
      console.log("❌ No se encontró usuario con 'teran'");
      client.release();
      await pool.end();
      return;
    }
    
    const user = userRes.rows[0];
    console.log("👤 Usuario:", user.name, `(${user.email})`);
    console.log("   ID:", user.id, "| Cargo:", user.cargoId, "| Sede:", user.sedeId, "| Unidad:", user.unidadId);
    
    // 2. Buscar evaluación más reciente
    const evalRes = await client.query(`
      SELECT id, "campaignId", source, "totalScore", "maxScore", "completedAt", "createdAt"
      FROM "Evaluation"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [user.id]);
    
    if (evalRes.rows.length === 0) {
      console.log("❌ No hay evaluaciones para este usuario");
      client.release();
      await pool.end();
      return;
    }
    
    const eval_ = evalRes.rows[0];
    console.log("\n📋 Evaluación:", eval_.id);
    console.log("   Source:", eval_.source);
    console.log("   TotalScore (BD):", eval_.totalScore);
    console.log("   MaxScore (BD):", eval_.maxScore);
    console.log("   CompletedAt:", eval_.completedAt);
    
    // 3. Buscar respuestas de esta evaluación
    const answersRes = await client.query(`
      SELECT a.id, a."questionId", a."optionId", a."awardedScore", 
             q.text as question_text,
             o.label as option_label, o.score as option_score
      FROM "Answer" a
      LEFT JOIN "Question" q ON q.id = a."questionId"
      LEFT JOIN "QuestionOption" o ON o.id = a."optionId"
      WHERE a."evaluationId" = $1
      ORDER BY a.id
    `, [eval_.id]);
    
    console.log("\n📝 Respuestas en la evaluación:");
    let totalCalc = 0;
    for (const ans of answersRes.rows) {
      const score = ans.option_score ?? ans.awardedScore ?? 0;
      totalCalc += score;
      console.log(`   Q${ans.questionId}: "${ans.question_text?.substring(0, 50)}..."`);
      console.log(`      → Opción: ${ans.option_label} | Score opción: ${ans.option_score} | awardedScore: ${ans.awardedScore} | Score final: ${score}`);
    }
    
    console.log(`\n📊 Total calculado desde respuestas: ${totalCalc}`);
    console.log(`📊 Total en BD: ${eval_.totalScore}`);
    
    // 4. Buscar otros usuarios del mismo grupo (sede+unidad)
    if (user.sedeId && user.unidadId) {
      const groupRes = await client.query(`
        SELECT id, name, email FROM "User"
        WHERE "sedeId" = $1 AND "unidadId" = $2 AND id != $3
      `, [user.sedeId, user.unidadId, user.id]);
      
      if (groupRes.rows.length > 0) {
        console.log("\n👥 Usuarios del mismo grupo (sede+unidad):");
        for (const u of groupRes.rows) {
          console.log(`   - ${u.name} (${u.email}) [ID: ${u.id}]`);
          
          // Ver si este grupo tiene respuestas en la misma campaña
          const groupAnswersRes = await client.query(`
            SELECT a.id, a."questionId", a."optionId", a."awardedScore",
                   e."userId", u.name as user_name,
                   q.text as question_text,
                   o.label as option_label, o.score as option_score
            FROM "Answer" a
            JOIN "Evaluation" e ON e.id = a."evaluationId"
            JOIN "User" u ON u.id = e."userId"
            LEFT JOIN "Question" q ON q.id = a."questionId"
            LEFT JOIN "QuestionOption" o ON o.id = a."optionId"
            WHERE e."campaignId" = $1 AND e."userId" = $2
            ORDER BY a.id
          `, [eval_.campaignId, u.id]);
          
          if (groupAnswersRes.rows.length > 0) {
            console.log(`     Respuestas en campaña ${eval_.campaignId}:`);
            for (const ga of groupAnswersRes.rows) {
              console.log(`       Q${ga.questionId}: "${ga.question_text?.substring(0, 40)}..." → ${ga.option_label} (${ga.option_score} pts) [by ${ga.user_name}]`);
            }
          }
        }
      }
    }
    
    client.release();
    await pool.end();
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }
})();
