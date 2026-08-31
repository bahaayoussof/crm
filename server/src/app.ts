
import cors, { type CorsOptions } from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { customerRouter } from "./modules/customers/customer.routes.js";
import { categoryRouter } from "./modules/categories/category.routes.js";
import { departmentRouter } from "./modules/departments/department.routes.js";
import { branchRouter } from "./modules/branches/branch.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { userRouter } from "./modules/users/user.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { portalRouter } from "./modules/portal/portal.routes.js";
import { knowledgeArticleRouter } from "./modules/knowledge-base/knowledge-article.routes.js";
import { quickReplyRouter } from "./modules/quick-replies/quick-reply.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { auditLogRouter } from "./modules/audit-logs/audit-log.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";
import { slaAutomationRouter } from "./modules/sla-automation/sla-automation.routes.js";
import { portalKnowledgeArticleRouter } from "./modules/knowledge-base/knowledge-article.portal.routes.js";
import { attachmentRouter } from "./modules/attachments/attachment.routes.js";
import { portalAttachmentRouter } from "./modules/attachments/attachment.portal.routes.js";
import { taskRouter } from "./modules/tasks/task.routes.js";
import { taskReminderRouter } from "./modules/tasks/task-reminder.routes.js";
import { whatsappRouter } from "./modules/integrations/whatsapp/whatsapp.routes.js";
import { emailIntegrationRouter } from "./modules/integrations/email/email.routes.js";
import { realtimeRouter } from "./modules/realtime/realtime.routes.js";


const allowedOrigins = new Set(env.CLIENT_URLS ?? [env.CLIENT_URL]);
const localDevelopmentOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isLocalDevelopmentOrigin = env.NODE_ENV !== "production" && localDevelopmentOrigin.test(origin);
    if (isLocalDevelopmentOrigin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

export const app = express();

app.disable("x-powered-by");
app.use(cors(corsOptions));

// WhatsApp webhook is mounted before express.json() so its POST body stays a raw
// Buffer for HMAC signature verification. All other routes use parsed JSON below.
app.use("/api/integrations/whatsapp", whatsappRouter);
app.use("/api/integrations/email", emailIntegrationRouter);

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});
app.use("/api/auth", authRouter);
app.use("/api/customers", customerRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/departments", departmentRouter);
app.use("/api/branches", branchRouter);
app.use("/api/users", userRouter);
app.use("/api/tickets", ticketRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/knowledge-articles", knowledgeArticleRouter);
app.use("/api/quick-replies", quickReplyRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/audit-logs", auditLogRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/realtime", realtimeRouter);
app.use("/api/internal/sla-monitor", slaAutomationRouter);
app.use("/api/internal/task-reminders", taskReminderRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/attachments", attachmentRouter);
app.use("/api/portal/knowledge-articles", portalKnowledgeArticleRouter);
app.use("/api/portal/attachments", portalAttachmentRouter);
app.use("/api/portal", portalRouter);

app.use(notFoundHandler);
app.use(errorHandler);
