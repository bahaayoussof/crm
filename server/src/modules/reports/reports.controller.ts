import type { RequestHandler, Response } from "express";
import type { ReportsAgentsQuery, ReportsRange } from "./reports.schema.js";
import { getAgentReports, getReportsOverview, getSlaReports, getTicketReports } from "./reports.service.js";

const range = (response: Response) => response.locals.validatedQuery as ReportsRange;
const agentsQuery = (response: Response) => response.locals.validatedQuery as ReportsAgentsQuery;

export const overview: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await getReportsOverview(range(response)) });

export const tickets: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await getTicketReports(range(response)) });

export const agents: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await getAgentReports(agentsQuery(response)) });

export const sla: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await getSlaReports(range(response)) });

