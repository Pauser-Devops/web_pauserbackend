import { PrismaClient } from './generated/prisma/index.js';
const p = new PrismaClient();
const rows = await p.campaign.findMany({ 
  take: 5, 
  orderBy: { createdAt: 'desc' }, 
  select: { id: true, name: true, startDate: true, endDate: true, isActive: true } 
});
console.log(JSON.stringify(rows, null, 2));
await p.$disconnect();
