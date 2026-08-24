import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { authRouter } from "./modules/auth/auth.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});
app.use("/api/auth", authRouter);

app.use(notFoundHandler);
app.use(errorHandler);
