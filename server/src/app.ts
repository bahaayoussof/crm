
import cors, { type CorsOptions } from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { customerRouter } from "./modules/customers/customer.routes.js";
import { categoryRouter } from "./modules/categories/category.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { userRouter } from "./modules/users/user.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { portalRouter } from "./modules/portal/portal.routes.js";


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
app.use(express.json());

// اترك بقية routes الموجودة كما هي

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});
app.use("/api/auth", authRouter);
app.use("/api/customers", customerRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/users", userRouter);
app.use("/api/tickets", ticketRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/portal", portalRouter);

app.use(notFoundHandler);
app.use(errorHandler);
