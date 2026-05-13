import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { authMiddleware, AuthRequest } from "../middleware/auth.ts";
import { getCurrentPeriod, parseId } from "../utils/frequency.ts";

const router = Router();

/** Parse "YYYY-MM-DD" string to local midnight (not UTC) */
function toLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Current date at midnight local */
function todayStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Current date at end of day local */
function todayEnd(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// POST /api/campaigns - Crear campaña (admin)
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden crear campañas" });
    }

    const { name, startDate, endDate, assignedUserIds, questionIds } = req.body;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        startDate: toLocalDate(startDate),
        endDate: toLocalDate(endDate),
        ...(assignedUserIds && assignedUserIds.length > 0 && {
          assignedUsers: {
            create: assignedUserIds.map((userId: number) => ({ userId })),
          },
        }),
        ...(questionIds && questionIds.length > 0 && {
          questions: {
            create: questionIds.map((questionId: number) => ({ questionId })),
          },
        }),
      },
      include: {
        assignedUsers: { include: { user: { select: { id: true, email: true, name: true } } } },
        questions: true,
      },
    });

    res.json(campaign);
  } catch (error) {
    console.error("Error al crear campaña:", error);
    res.status(500).json({ error: "Error al crear campaña" });
  }
});

// GET /api/campaigns - Listar campañas (admin)
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden ver campañas" });
    }

    const campaigns = await prisma.campaign.findMany({
      orderBy: { startDate: "asc" },
      include: {
        assignedUsers: { 
          include: { 
            user: { select: { id: true, email: true, name: true, cargoId: true } } 
          } 
        },
        evaluations: { 
          include: { answers: { include: { files: true } } },
        },
      },
    });

    // Fetch all active questions with cargo assignments
    const allQuestions = await prisma.question.findMany({
      where: { isActive: true },
      include: { cargos: true },
    });

    // Use date-only comparison to avoid UTC/timezone issues
    const todayStr = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local time

    const campaignsWithStats = campaigns.map((c) => {
      const totalAssigned = c.assignedUsers.length;
      // Extract date part from DB timestamps (stored as UTC midnight, need local date)
      const startDate = new Date(c.startDate);
      const endDate = new Date(c.endDate);
      const startStr = startDate.toLocaleDateString("en-CA");
      const endStr = endDate.toLocaleDateString("en-CA");

      let status: string;
      if (todayStr < startStr) {
        status = "proximamente";
      } else if (todayStr > endStr) {
        status = "cerrado";
      } else {
        status = "activo";
      }

      let completed = 0;

      for (const au of c.assignedUsers) {
        const userCargoId = au.user.cargoId;

        const relevantQuestions = allQuestions.filter((q) => {
          if (q.cargos.length === 0) return true; // sin cargo = visible para todos
          return q.cargos.some((qc) => qc.cargoId === userCargoId);
        });

        let totalExpectedInstances = 0;
        for (const q of relevantQuestions) {
          totalExpectedInstances += q.frequencyType === "UNICA" ? 1 : 1;
        }

        if (totalExpectedInstances === 0) continue;

        const evaluation = c.evaluations.find((e) => e.userId === au.userId && e.completedAt);

        if (evaluation) {
          const answeredQuestionIds = evaluation.answers.map((a: { questionId: number }) => a.questionId);

          const answeredCount = relevantQuestions.filter((q) =>
            answeredQuestionIds.includes(q.id)
          ).length;

          if (answeredCount >= relevantQuestions.length) {
            completed++;
          }
        }
      }

      return {
        ...c,
        stats: { totalAssigned, completed, pending: totalAssigned - completed },
        status,
      };
    });

    res.json(campaignsWithStats);
  } catch (error) {
    console.error("Error al listar campañas:", error);
    res.status(500).json({ error: "Error al listar campañas" });
  }
});

// GET /api/campaigns/active - Obtener campaña activa dentro de rango de fechas
router.get("/active", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const now = todayEnd();
    const today = todayStart();
    const campaign = await prisma.campaign.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: today },
      },
      orderBy: { startDate: "desc" },
    });
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener campaña" });
  }
});

// GET /api/campaigns/active/assigned - Ver si usuario tiene campaña asignada vigente
router.get("/active/assigned", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const now = todayEnd();
    const today = todayStart();
    
    const campaign = await prisma.campaign.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: today },
      },
      orderBy: { startDate: "desc" },
    });

    if (!campaign) {
      return res.json({ assigned: false, campaign: null });
    }

    const assignment = await prisma.campaignUser.findUnique({
      where: { campaignId_userId: { campaignId: campaign.id, userId } },
    });

    res.json({ assigned: !!assignment, campaign });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar asignación" });
  }
});

// GET /api/campaigns/my-assigned - Todas las campañas del usuario con estado
router.get("/my-assigned", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const todayStr = new Date().toLocaleDateString("en-CA");

    // Obtener campañas asignadas explícitamente
    const assignments = await prisma.campaignUser.findMany({
      where: { userId },
      include: {
        campaign: {
          include: { questions: { select: { questionId: true } } },
        },
      },
      orderBy: { campaign: { startDate: "asc" } },
    });

    // Obtener campañas activas globales (sin asignaciones explícitas)
    const globalCampaigns = await prisma.campaign.findMany({
      where: { isActive: true },
      include: { questions: { select: { questionId: true } } },
      orderBy: { startDate: "asc" },
    });

    // Combinar y deduplicar
    const campaignMap = new Map();
    assignments.forEach(a => {
      campaignMap.set(a.campaign.id, a.campaign);
    });
    globalCampaigns.forEach(c => {
      if (!campaignMap.has(c.id)) {
        campaignMap.set(c.id, c);
      }
    });

    const result = Array.from(campaignMap.values()).map(c => {
      const startStr = new Date(c.startDate).toLocaleDateString("en-CA");
      const endStr = new Date(c.endDate).toLocaleDateString("en-CA");
      let status: string;
      if (!c.isActive) status = "inactivo";
      else if (todayStr < startStr) status = "proximamente";
      else if (todayStr > endStr) status = "cerrado";
      else status = "activo";

      return {
        id: c.id,
        name: c.name,
        startDate: c.startDate,
        endDate: c.endDate,
        status,
        questionsCount: c.questions.length,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener campañas" });
  }
});

// GET /api/campaigns/:id - Ver campaña con detalles (admin)
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden ver campañas" });
    }

    const { id } = req.params;
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseId(id) },
      include: {
        assignedUsers: { include: { user: { select: { id: true, email: true, name: true } } } },
        evaluations: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { totalScore: "desc" },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaña no encontrada" });
    }

    const pendingUsers = campaign.assignedUsers
      .filter((au) => !campaign.evaluations.some((e) => e.userId === au.userId))
      .map((au) => au.user);

    res.json({ ...campaign, pendingUsers });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener campaña" });
  }
});

// PUT /api/campaigns/:id - Actualizar campaña (admin)
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden modificar campañas" });
    }

    const { id } = req.params;
    const { name, startDate, endDate, assignedUserIds, questionIds } = req.body;
    const campaignId = parseId(id);

    if (assignedUserIds !== undefined) {
      await prisma.campaignUser.deleteMany({ where: { campaignId } });
      if (assignedUserIds.length > 0) {
        await prisma.campaignUser.createMany({
          data: assignedUserIds.map((userId: number) => ({ campaignId, userId })),
        });
      }
    }

    if (questionIds !== undefined) {
      await prisma.campaignQuestion.deleteMany({ where: { campaignId } });
      if (questionIds.length > 0) {
        await prisma.campaignQuestion.createMany({
          data: questionIds.map((questionId: number) => ({ campaignId, questionId })),
        });
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: toLocalDate(startDate) }),
        ...(endDate && { endDate: toLocalDate(endDate) }),
      },
      include: {
        assignedUsers: { include: { user: { select: { id: true, email: true, name: true } } } },
        questions: true,
      },
    });

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar campaña" });
  }
});

// POST /api/campaigns/:id/assign - Asignar usuarios a campaña (admin)
router.post("/:id/assign", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden asignar usuarios" });
    }

    const { id } = req.params;
    const { userIds } = req.body;
    const campaignId = parseId(id);

    const newAssignments = userIds
      .filter((userId: number) => true)
      .map((userId: number) => ({ campaignId, userId }));

    if (newAssignments.length > 0) {
      await prisma.campaignUser.createMany({
        data: newAssignments,
        skipDuplicates: true,
      });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { assignedUsers: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: "Error al asignar usuarios" });
  }
});

// DELETE /api/campaigns/:id/assign/:userId - Desasignar usuario (admin)
router.delete("/:id/assign/:userId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden desasignar usuarios" });
    }

    const { id, userId } = req.params;
    await prisma.campaignUser.delete({
      where: { campaignId_userId: { campaignId: parseId(id), userId: parseId(userId) } },
    });

    res.json({ message: "Usuario desasignado" });
  } catch (error) {
    res.status(500).json({ error: "Error al desasignar usuario" });
  }
});


// GET /api/campaigns/:id/questions - Obtener preguntas de campaña
router.get("/:id/questions", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const campaignId = parseId(id);

    const questions = await prisma.campaignQuestion.findMany({
      where: { campaignId },
      include: {
        question: {
          include: {
            options: { orderBy: { label: "asc" } },
            cargos: { include: { cargo: true } },
            configs: true,
          },
        },
      },
    });

    res.json(questions.map(q => q.question));
  } catch (error) {
    res.status(500).json({ error: "Error al obtener preguntas" });
  }
});

// POST /api/campaigns/:id/questions - Asignar preguntas a campaña
router.post("/:id/questions", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden asignar preguntas" });
    }

    const { id } = req.params;
    const { questionIds } = req.body;
    const campaignId = parseId(id);

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: "Debes enviar al menos una pregunta" });
    }

    await prisma.campaignQuestion.createMany({
      data: questionIds.map((qid: number) => ({ campaignId, questionId: qid })),
      skipDuplicates: true,
    });

    const result = await prisma.campaignQuestion.findMany({
      where: { campaignId },
      include: { question: true },
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error al asignar preguntas" });
  }
});

// DELETE /api/campaigns/:id/questions/:questionId - Quitar pregunta de campaña
router.delete("/:id/questions/:questionId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden quitar preguntas" });
    }

    const { id, questionId } = req.params;

    await prisma.campaignQuestion.delete({
      where: { campaignId_questionId: { campaignId: parseId(id), questionId: parseId(questionId) } },
    });

    res.json({ message: "Pregunta removida de la campaña" });
  } catch (error) {
    res.status(500).json({ error: "Error al quitar pregunta" });
  }
});

// DELETE /api/campaigns/:id - Eliminar campaña (admin)
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user?.roleId !== 1) {
      return res.status(403).json({ error: "Solo admins pueden eliminar campañas" });
    }

    const { id } = req.params;
    const campaignId = parseId(id);

    // Delete related records first
    await prisma.evaluation.deleteMany({ where: { campaignId } });
    await prisma.campaignUser.deleteMany({ where: { campaignId } });
    await prisma.campaignQuestion.deleteMany({ where: { campaignId } });
    
    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    res.json({ message: "Campaña eliminada" });
  } catch (error: any) {
    console.error("Error al eliminar campaña:", error);
    res.status(500).json({ error: error.message || "Error al eliminar campaña" });
  }
});

export default router;