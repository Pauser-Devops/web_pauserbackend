import { prisma } from "../src/lib/prisma.ts";

async function main() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    console.log("now:", now);
    console.log("today:", today);
    console.log("todayEnd:", todayEnd);

    let campaign = await prisma.campaign.findFirst({
        where: { isActive: true, startDate: { lte: todayEnd }, endDate: { gte: today } },
        orderBy: { startDate: "desc" },
    });

    console.log("Campaign from current logic:", campaign?.name);

    if (!campaign) {
        campaign = await prisma.campaign.findFirst({
          where: { isActive: true },
          orderBy: { startDate: "desc" },
        });
        console.log("Campaign from fallback logic:", campaign?.name);
    }
}

main().finally(() => prisma.$disconnect());
