import { prisma } from "../src/lib/prisma.ts";

async function main() {
  await prisma.campaign.updateMany({
    where: { isActive: false },
    data: { isActive: true },
  });
  console.log("Activadas las campañas que estaban eliminadas/inactivas.");
}

main().finally(() => prisma.$disconnect());
