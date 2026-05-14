"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const prisma_ts_1 = require("./lib/prisma.ts");
const auth_ts_1 = __importDefault(require("./routes/auth.ts"));
const users_ts_1 = __importDefault(require("./routes/users.ts"));
const questions_ts_1 = __importDefault(require("./routes/questions.ts"));
const evaluations_ts_1 = __importDefault(require("./routes/evaluations.ts"));
const campaigns_ts_1 = __importDefault(require("./routes/campaigns.ts"));
const evalCategories_ts_1 = __importDefault(require("./routes/evalCategories.ts"));
const references_ts_1 = __importDefault(require("./routes/references.ts"));
const programs_ts_1 = __importDefault(require("./routes/programs.ts"));
const reports_ts_1 = __importDefault(require("./routes/reports.ts"));
const auth_ts_2 = require("./middleware/auth.ts");
const expireDelegations_ts_1 = require("./jobs/expireDelegations.ts");
const autoSubmitDrafts_ts_1 = require("./jobs/autoSubmitDrafts.ts");
const JOB_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
function startScheduledJobs() {
    console.log("[scheduler] Starting scheduled jobs (interval: 1h)...");
    // Run once on startup
    (0, expireDelegations_ts_1.expireDelegations)().catch(err => console.error("[scheduler] expireDelegations startup error:", err));
    (0, autoSubmitDrafts_ts_1.autoSubmitDrafts)().catch(err => console.error("[scheduler] autoSubmitDrafts startup error:", err));
    // Schedule recurring runs
    setInterval(() => {
        (0, expireDelegations_ts_1.expireDelegations)().catch(err => console.error("[scheduler] expireDelegations error:", err));
    }, JOB_INTERVAL_MS);
    setInterval(() => {
        (0, autoSubmitDrafts_ts_1.autoSubmitDrafts)().catch(err => console.error("[scheduler] autoSubmitDrafts error:", err));
    }, JOB_INTERVAL_MS);
}
console.log(">>> Starting server...");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "https://pauserdistribucionessac.com",
        "https://www.pauserdistribucionessac.com",
        process.env.FRONTEND_URL || ""
    ].filter(Boolean),
    credentials: true,
}));
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
app.use("/api/auth", auth_ts_1.default);
app.use("/api/users", auth_ts_2.authMiddleware, users_ts_1.default);
app.use("/api/questions", auth_ts_2.authMiddleware, questions_ts_1.default);
app.use("/api/evaluations", auth_ts_2.authMiddleware, evaluations_ts_1.default);
app.use("/api/campaigns", auth_ts_2.authMiddleware, campaigns_ts_1.default);
app.use("/api/eval-categories", auth_ts_2.authMiddleware, evalCategories_ts_1.default);
app.use("/api/references", auth_ts_2.authMiddleware, references_ts_1.default);
app.use("/api/programs", auth_ts_2.authMiddleware, programs_ts_1.default);
app.use("/api/reports", auth_ts_2.authMiddleware, reports_ts_1.default);
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const programFiles_ts_1 = __importDefault(require("./routes/programFiles.ts"));
const delegations_ts_1 = __importDefault(require("./routes/delegations.ts"));
const approvals_ts_1 = __importDefault(require("./routes/approvals.ts"));
const uploadsDir = path_1.default.join(process.cwd(), "uploads");
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/api/program-files", programFiles_ts_1.default);
app.use("/api/delegations", delegations_ts_1.default);
app.use("/api/approvals", approvals_ts_1.default);
app.use("/uploads", express_1.default.static(uploadsDir));
app.get("/api/test", (req, res) => {
    console.log(">>> /api/test called");
    res.json({ test: "ok" });
});
app.get("/api/health", (req, res) => {
    console.log(">>> /api/health called");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Debug: verificar estado de la BD
app.get("/api/test-db", async (req, res) => {
    try {
        const userCount = await prisma_ts_1.prisma.user.count();
        const roleCount = await prisma_ts_1.prisma.role.count();
        const tables = await prisma_ts_1.prisma.$queryRaw `
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
        res.json({
            status: "connected",
            database: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown",
            userCount,
            roleCount,
            tables: tables.map(t => t.table_name),
        });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});
// Error handler global
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
});
console.log(">>> About to listen...");
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    startScheduledJobs();
});
exports.default = app;
//# sourceMappingURL=index.js.map