import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsRoute } from "./settings-route";
const state = vi.hoisted(() => ({ role: "ADMIN" }));
afterEach(cleanup);
vi.mock("@/features/auth/auth-state", () => ({ useAuth: () => ({ user: { role: state.role } }) }));
describe("SettingsRoute", () => { it.each(["MANAGER", "AGENT", "CUSTOMER"])("redirects %s", (role) => { state.role = role; render(<MemoryRouter initialEntries={["/settings"]}><Routes><Route path="/dashboard" element={<p>Dashboard</p>} /><Route element={<SettingsRoute />}><Route path="/settings" element={<p>Settings</p>} /></Route></Routes></MemoryRouter>); expect(screen.getByText("Dashboard")).toBeInTheDocument(); }); it("allows ADMIN", () => { state.role = "ADMIN"; render(<MemoryRouter initialEntries={["/settings"]}><Routes><Route element={<SettingsRoute />}><Route path="/settings" element={<p>Settings</p>} /></Route></Routes></MemoryRouter>); expect(screen.getByText("Settings")).toBeInTheDocument(); }); });
