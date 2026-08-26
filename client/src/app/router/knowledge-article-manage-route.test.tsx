import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "AGENT" as "ADMIN" | "MANAGER" | "AGENT" }));
vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null } }),
}));

import { KnowledgeArticleManageRoute } from "./knowledge-article-manage-route";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("KnowledgeArticleManageRoute", () => {
  afterEach(cleanup);

  it.each(["/knowledge-base/new", "/knowledge-base/article-1/edit"])("redirects AGENT away from %s with replace navigation", (path) => {
    mocks.role = "AGENT";
    render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route element={<KnowledgeArticleManageRoute />}>
        <Route path="/knowledge-base/new" element={<span>Editor</span>} />
        <Route path="/knowledge-base/:id/edit" element={<span>Editor</span>} />
      </Route>
      <Route path="/knowledge-base" element={<Location />} />
    </Routes></MemoryRouter>);
    expect(screen.queryByText("Editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/knowledge-base");
  });

  it.each(["ADMIN", "MANAGER"] as const)("allows %s to open the knowledge base editor", (role) => {
    mocks.role = role;
    render(<MemoryRouter initialEntries={["/knowledge-base/new"]}><Routes>
      <Route element={<KnowledgeArticleManageRoute />}><Route path="/knowledge-base/new" element={<span>Editor</span>} /></Route>
    </Routes></MemoryRouter>);
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });
});
