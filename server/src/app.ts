import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { customerRouter } from "./modules/customers/customer.routes.js";
import { categoryRouter } from "./modules/categories/category.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { userRouter } from "./modules/users/user.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173" }));
app.use(express.json());

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
