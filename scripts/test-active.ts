import { prisma } from "../src/lib/prisma.ts";

export const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const todayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

async function main() {
    const now = todayEnd();
    const today = todayStart();
    console.log("now:", now);
    console.log("today:", today);
    const campaign = await prisma.campaign.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: today },
      },
      orderBy: { startDate: "desc" },
    });
    console.log("Active campaign:", campaign?.id);
}

main().finally(() => prisma.$disconnect());
