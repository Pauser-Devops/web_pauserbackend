import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.ts";
import usersRoutes from "./routes/users.ts";
import questionsRoutes from "./routes/questions.ts";
import evaluationsRoutes from "./routes/evaluations.ts";
import campaignsRoutes from "./routes/campaigns.ts";
import evalCategoriesRoutes from "./routes/evalCategories.ts";
import referencesRoutes from "./routes/references.ts";
import programsRoutes from "./routes/programs.ts";
import reportsRoutes from "./routes/reports.ts";
import { authMiddleware } from "./middleware/auth.ts";

console.log(">>> Starting server...");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
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

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", authMiddleware, usersRoutes);
app.use("/api/questions", authMiddleware, questionsRoutes);
app.use("/api/evaluations", authMiddleware, evaluationsRoutes);
app.use("/api/campaigns", authMiddleware, campaignsRoutes);
app.use("/api/eval-categories", authMiddleware, evalCategoriesRoutes);
app.use("/api/references", authMiddleware, referencesRoutes);
app.use("/api/programs", authMiddleware, programsRoutes);
app.use("/api/reports", authMiddleware, reportsRoutes);

import path from "path";
import fs from "fs";
import multer from "multer";

import programFilesRoutes from "./routes/programFiles.ts";
import delegationsRoutes from "./routes/delegations.ts";
import approvalsRoutes from "./routes/approvals.ts";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/api/program-files", programFilesRoutes);
app.use("/api/delegations", delegationsRoutes);
app.use("/api/approvals", approvalsRoutes);

app.use("/uploads", express.static(uploadsDir));


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
    const userCount = await prisma.user.count();
    const roleCount = await prisma.role.count();
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    res.json({
      status: "connected",
      database: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "unknown",
      userCount,
      roleCount,
      tables: (tables as any[]).map(t => t.table_name),
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Error handler global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

console.log(">>> About to listen...");

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;