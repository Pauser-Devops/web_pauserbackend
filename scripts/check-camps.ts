import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const camps = await prisma.campaign.findMany({
    orderBy: { startDate: "asc" }
  });
  console.log(JSON.stringify(camps.map(c => ({
    id: c.id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    isActive: c.isActive
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
