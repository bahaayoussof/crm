import express, { Router } from "express";
import { receiveEmailWebhook } from "./email.controller.js";

export const emailIntegrationRouter = Router();
emailIntegrationRouter.post("/webhook", express.raw({ type: () => true, limit: "1mb" }), receiveEmailWebhook);
