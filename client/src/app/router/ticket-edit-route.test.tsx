import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "AGENT" as "ADMIN" | "MANAGER" | "AGENT" }));
vi.mock("@/features/auth/auth-state", () => ({ useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null } }) }));
import { TicketEditRoute } from "./ticket-edit-route";

function Location() { return <span data-testid="location">{useLocation().pathname}</span>; }
describe("TicketEditRoute", () => {
  afterEach(cleanup);
  it("redirects an agent from edit to detail", () => { mocks.role = "AGENT"; render(<MemoryRouter initialEntries={["/tickets/ticket-1/edit"]}><Routes><Route element={<TicketEditRoute />}><Route path="/tickets/:id/edit" element={<span>Form</span>} /></Route><Route path="/tickets/:id" element={<Location />} /></Routes></MemoryRouter>); expect(screen.queryByText("Form")).not.toBeInTheDocument(); expect(screen.getByTestId("location")).toHaveTextContent("/tickets/ticket-1"); });
  it.each(["ADMIN", "MANAGER"] as const)("allows %s to edit", (role) => { mocks.role = role; render(<MemoryRouter initialEntries={["/tickets/ticket-1/edit"]}><Routes><Route element={<TicketEditRoute />}><Route path="/tickets/:id/edit" element={<span>Form</span>} /></Route></Routes></MemoryRouter>); expect(screen.getByText("Form")).toBeInTheDocument(); });
});
