import express, { Router } from "express";
import { receiveSmsWebhook } from "./sms.controller.js";
export const smsIntegrationRouter = Router();
smsIntegrationRouter.post("/webhook", express.raw({ type: () => true, limit: "1mb" }), receiveSmsWebhook);
