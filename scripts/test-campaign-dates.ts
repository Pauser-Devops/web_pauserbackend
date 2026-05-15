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

async function testCampaignDates() {
  console.log("=".repeat(80));
  console.log("TEST DE FECHAS DE CAMPAÑAS - DB → BACKEND → FRONTEND");
  console.log("=".repeat(80));
  console.log();

  const campaigns = await prisma.campaign.findMany({
    orderBy: { startDate: "asc" },
    include: {
      evaluations: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  console.log(`Total de campañas en BD: ${campaigns.length}`);
  console.log();

  const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MONTHS_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const fmtCampaignDate = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${parseInt(d)} ${MONTHS_ES[parseInt(m) - 1]}`;
  };

  const fmtTimestamp = (iso: string) => {
    return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  };

  const fmtTimestampTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  let allPassed = true;

  for (const c of campaigns) {
    console.log(`--- Campaña #${c.id}: "${c.name}" ---`);
    
    // 1. Lo que está en la BD (raw)
    console.log("  [BD RAW]");
    console.log(`    startDate: ${c.startDate.toISOString()}`);
    console.log(`    endDate:   ${c.endDate.toISOString()}`);
    
    // 2. Lo que el frontend debería mostrar (fmtCampaignDate extrae YYYY-MM-DD directo)
    const frontStart = fmtCampaignDate(c.startDate.toISOString());
    const frontEnd = fmtCampaignDate(c.endDate.toISOString());
    
    console.log("  [FRONTEND DISPLAY]");
    console.log(`    startDate: ${frontStart}`);
    console.log(`    endDate:   ${frontEnd}`);
    
    // 3. Verificación: ¿coincide con lo esperado?
    const [startY, startM, startD] = c.startDate.toISOString().slice(0, 10).split("-");
    const [endY, endM, endD] = c.endDate.toISOString().slice(0, 10).split("-");
    
    const expectedStart = `${parseInt(startD)} ${MONTHS_ES[parseInt(startM) - 1]}`;
    const expectedEnd = `${parseInt(endD)} ${MONTHS_ES[parseInt(endM) - 1]}`;
    
    const startMatch = frontStart === expectedStart;
    const endMatch = frontEnd === expectedEnd;
    
    console.log("  [VERIFICACIÓN]");
    console.log(`    startDate: ${startMatch ? "✅ OK" : "❌ MISMATCH"} (esperado: ${expectedStart}, obtenido: ${frontStart})`);
    console.log(`    endDate:   ${endMatch ? "✅ OK" : "❌ MISMATCH"} (esperado: ${expectedEnd}, obtenido: ${frontEnd})`);
    
    if (!startMatch || !endMatch) allPassed = false;
    
    // 4. Test del bug anterior (conversión incorrecta con new Date)
    const wrongStart = new Date(c.startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    const wrongEnd = new Date(c.endDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    
    console.log("  [BUG ANTERIOR - new Date() conversion]");
    console.log(`    startDate: ${wrongStart} ${wrongStart !== frontStart ? "️ INCORRECTO" : "✅ igual"}`);
    console.log(`    endDate:   ${wrongEnd} ${wrongEnd !== frontEnd ? "⚠️ INCORRECTO" : "✅ igual"}`);
    
    // 5. Evaluaciones de esta campaña
    console.log("  [EVALUACIONES]");
    if (c.evaluations.length === 0) {
      console.log("    (sin evaluaciones)");
    } else {
      for (const ev of c.evaluations) {
        const userName = ev.user.name || ev.user.email;
        console.log(`    Eval #${ev.id} - ${userName}`);
        console.log(`      source: ${ev.source}`);
        console.log(`      score: ${ev.totalScore}/${ev.maxScore}`);
        if (ev.completedAt) {
          const completedDate = fmtTimestamp(ev.completedAt.toISOString());
          const completedTime = fmtTimestampTime(ev.completedAt.toISOString());
          console.log(`      completedAt: ${completedDate} ${completedTime}`);
          console.log(`      completedAt (ISO): ${ev.completedAt.toISOString()}`);
        } else {
          console.log(`      completedAt: (pendiente)`);
        }
      }
    }
    
    console.log();
  }

  console.log("=".repeat(80));
  console.log("RESUMEN DE ZONA HORARIA");
  console.log("=".repeat(80));
  
  const now = new Date();
  console.log(`  Hora del servidor (UTC): ${now.toISOString()}`);
  console.log(`  Offset del servidor: ${-now.getTimezoneOffset() / 60}h`);
  console.log();
  console.log("  Nota: El backend usa new Date(year, month-1, day) que crea fecha en hora local del servidor.");
  console.log("  Si el servidor está en UTC, '15 mayo' se guarda como 2026-05-15T00:00:00.000Z");
  console.log("  El frontend en Perú (UTC-5) vería eso como 14 mayo 19:00 si usa new Date() directamente.");
  console.log("  La solución es extraer YYYY-MM-DD del ISO string sin conversión de zona horaria.");
  console.log();
  
  console.log("=".repeat(80));
  console.log(`RESULTADO FINAL: ${allPassed ? "✅ TODAS LAS FECHAS SON CORRECTAS" : "❌ HAY ERRORES EN LAS FECHAS"}`);
  console.log("=".repeat(80));

  await prisma.$disconnect();
}

testCampaignDates().catch(console.error);
