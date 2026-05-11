import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { id: "desc" },
    take: 5
  });
  console.log(JSON.stringify(campaigns, null, 2));
}

main().finally(() => prisma.$disconnect());
