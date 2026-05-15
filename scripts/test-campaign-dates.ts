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
  });

  console.log(`Total de campañas en BD: ${campaigns.length}`);
  console.log();

  for (const c of campaigns) {
    console.log(`--- Campaña #${c.id}: "${c.name}" ---`);
    
    // 1. Lo que está en la BD (raw)
    console.log("  [BD RAW]");
    console.log(`    startDate: ${c.startDate.toISOString()}`);
    console.log(`    endDate:   ${c.endDate.toISOString()}`);
    
    // 2. Lo que el backend procesa (toLocalDate convierte YYYY-MM-DD a Date local)
    const startDateRaw = c.startDate.toISOString().slice(0, 10);
    const endDateRaw = c.endDate.toISOString().slice(0, 10);
    
    console.log("  [BACKEND PROCESADO]");
    console.log(`    startDate (ISO slice): ${startDateRaw}`);
    console.log(`    endDate (ISO slice):   ${endDateRaw}`);
    
    // 3. Lo que el frontend debería mostrar (fmtCampaignDate extrae YYYY-MM-DD directo)
    const [startY, startM, startD] = startDateRaw.split("-");
    const [endY, endM, endD] = endDateRaw.split("-");
    const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    
    const frontStart = `${parseInt(startD)} ${MONTHS_ES[parseInt(startM) - 1]}`;
    const frontEnd = `${parseInt(endD)} ${MONTHS_ES[parseInt(endM) - 1]}`;
    
    console.log("  [FRONTEND DISPLAY]");
    console.log(`    startDate: ${frontStart}`);
    console.log(`    endDate:   ${frontEnd}`);
    
    // 4. Verificación: ¿coincide con lo esperado?
    const expectedStart = `${parseInt(startD)} ${MONTHS_ES[parseInt(startM) - 1]}`;
    const expectedEnd = `${parseInt(endD)} ${MONTHS_ES[parseInt(endM) - 1]}`;
    
    const startMatch = frontStart === expectedStart;
    const endMatch = frontEnd === expectedEnd;
    
    console.log("  [VERIFICACIÓN]");
    console.log(`    startDate: ${startMatch ? "✅ OK" : "❌ MISMATCH"} (esperado: ${expectedStart}, obtenido: ${frontStart})`);
    console.log(`    endDate:   ${endMatch ? "✅ OK" : "❌ MISMATCH"} (esperado: ${expectedEnd}, obtenido: ${frontEnd})`);
    
    // 5. Test del bug anterior (conversión incorrecta con new Date)
    const wrongStart = new Date(c.startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    const wrongEnd = new Date(c.endDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    
    console.log("  [BUG ANTERIOR - new Date() conversion]");
    console.log(`    startDate: ${wrongStart} ${wrongStart !== frontStart ? "⚠️ INCORRECTO" : "✅ igual"}`);
    console.log(`    endDate:   ${wrongEnd} ${wrongEnd !== frontEnd ? "⚠️ INCORRECTO" : "✅ igual"}`);
    
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

  await prisma.$disconnect();
}

testCampaignDates().catch(console.error);
