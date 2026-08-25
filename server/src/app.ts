
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


const localOriginPattern =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowedLocalOrigin =
      env.NODE_ENV !== "production" &&
      localOriginPattern.test(origin);

    const isConfiguredProductionOrigin = origin === env.CLIENT_URL;

    if (isAllowedLocalOrigin || isConfiguredProductionOrigin) {
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

app.use(notFoundHandler);
app.use(errorHandler);
