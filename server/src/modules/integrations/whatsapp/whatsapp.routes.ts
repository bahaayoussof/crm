import express, { Router } from "express";
import { receiveWebhook, verifyWebhook } from "./whatsapp.controller.js";

/**
 * WhatsApp Cloud API webhook. Mounted in app.ts BEFORE express.json() so the
 * POST body stays a raw Buffer for HMAC signature verification. These are
 * external machine endpoints — authentication is the Meta signature / verify
 * token, not a product JWT.
 */
export const whatsappRouter = Router();

whatsappRouter.get("/webhook", verifyWebhook);
whatsappRouter.post("/webhook", express.raw({ type: () => true, limit: "1mb" }), receiveWebhook);
