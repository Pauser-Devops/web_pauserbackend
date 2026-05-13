"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
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
console.log(">>> Starting server...");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
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
// Error handler global
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
});
console.log(">>> About to listen...");
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map