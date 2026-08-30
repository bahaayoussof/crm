import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditLogRoute } from "./audit-log-route";
const state = vi.hoisted(() => ({ role: "ADMIN" }));
vi.mock("@/features/auth/auth-state", () => ({ useAuth: () => ({ user: { role: state.role } }) }));
afterEach(cleanup);
describe("AuditLogRoute", () => { it.each(["MANAGER", "AGENT", "CUSTOMER"])("redirects %s", (role) => { state.role = role; render(<MemoryRouter initialEntries={["/audit-logs"]}><Routes><Route path="/dashboard" element={<p>Dashboard</p>} /><Route element={<AuditLogRoute />}><Route path="/audit-logs" element={<p>Audit Logs</p>} /></Route></Routes></MemoryRouter>); expect(screen.getByText("Dashboard")).toBeInTheDocument(); }); it("allows ADMIN", () => { state.role = "ADMIN"; render(<MemoryRouter initialEntries={["/audit-logs"]}><Routes><Route element={<AuditLogRoute />}><Route path="/audit-logs" element={<p>Audit Logs</p>} /></Route></Routes></MemoryRouter>); expect(screen.getByText("Audit Logs")).toBeInTheDocument(); }); });
