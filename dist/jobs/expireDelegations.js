"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireDelegations = expireDelegations;
const prisma_ts_1 = require("../lib/prisma.ts");
async function expireDelegations() {
    console.log("[expireDelegations] Running...");
    try {
        const result = await prisma_ts_1.prisma.answerDelegation.updateMany({
            where: {
                status: "PENDIENTE",
                deadlineAt: {
                    lt: new Date(),
                },
            },
            data: {
                status: "VENCIDO",
            },
        });
        console.log(`[expireDelegations] Marked ${result.count} delegations as VENCIDO`);
        return result.count;
    }
    catch (error) {
        console.error("[expireDelegations] Error:", error);
        throw error;
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    expireDelegations()
        .then((count) => {
        console.log(`Done: ${count} expired`);
        process.exit(0);
    })
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=expireDelegations.js.map