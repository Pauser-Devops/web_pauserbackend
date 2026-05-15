import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const camps = await prisma.campaign.findMany({
    orderBy: { id: "asc" },
  });
  for (const c of camps) {
    console.log(`ID:${c.id} | ${c.name} | Inicio: ${c.startDate.toISOString().slice(0, 10)} | Fin: ${c.endDate.toISOString().slice(0, 10)} | Activa: ${c.isActive}`);
  }
  process.exit(0);
}

main();
