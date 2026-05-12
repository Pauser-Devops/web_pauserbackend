import { prisma } from "../src/lib/prisma.ts";
async function main() {
  const camps = await prisma.campaign.findMany({
    orderBy: { startDate: "desc" }
  });
  console.log(camps);
}
main().finally(() => prisma.$disconnect());
