import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  useKnowledgeArticles: vi.fn(), useKnowledgeArticle: vi.fn(),
  useCreateKnowledgeArticle: vi.fn(), useUpdateKnowledgeArticle: vi.fn(), useDeleteKnowledgeArticle: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  role: "ADMIN" as "ADMIN" | "MANAGER" | "AGENT",
}));

vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: { id: "user-1", name: "User", email: "user@example.com", role: mocks.role, customer: null }, isLoading: false, logout: vi.fn() }),
}));

vi.mock("./knowledge-article-hooks", () => ({
  useKnowledgeArticles: mocks.useKnowledgeArticles,
  useKnowledgeArticle: mocks.useKnowledgeArticle,
  useCreateKnowledgeArticle: mocks.useCreateKnowledgeArticle,
  useUpdateKnowledgeArticle: mocks.useUpdateKnowledgeArticle,
  useDeleteKnowledgeArticle: mocks.useDeleteKnowledgeArticle,
}));

import { AppShell } from "@/app/layouts/app-shell";
import { KnowledgeArticleFormPage } from "./knowledge-article-form-page";
import { KnowledgeBaseDetailPage } from "./knowledge-base-detail-page";
import { KnowledgeBaseListPage } from "./knowledge-base-list-page";

const longTitle = "How to reset your password when the account recovery email keeps failing and support is unavailable";
const listItem = {
  id: "article-1", title: longTitle, category: "Accounts", status: "PUBLISHED" as const,
  createdAt: "2026-08-20T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z",
  createdBy: { id: "admin-1", name: "Admin User", role: "ADMIN" as const },
};
const detailArticle = { ...listItem, title: "Reset your password", content: "Step one. Do this.\n\nStep two <script>alert(1)</script> stays literal." };

function renderAt(path: string, route: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>{route}</Routes></MemoryRouter>);
}
function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("knowledge base", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.role = "ADMIN";
    mocks.useKnowledgeArticles.mockReturnValue({ isLoading: false, isError: false, data: { data: [listItem], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, refetch: vi.fn() });
    mocks.useKnowledgeArticle.mockReturnValue({ isLoading: false, isError: false, data: detailArticle, refetch: vi.fn() });
    mocks.useCreateKnowledgeArticle.mockReturnValue({ mutateAsync: mocks.create, isPending: false });
    mocks.useUpdateKnowledgeArticle.mockReturnValue({ mutateAsync: mocks.update, isPending: false });
    mocks.useDeleteKnowledgeArticle.mockReturnValue({ mutateAsync: mocks.remove, isPending: false });
  });

  it.each(["ADMIN", "MANAGER", "AGENT"] as const)("shows the Knowledge Base navigation item for %s", (role) => {
    mocks.role = role;
    render(<MemoryRouter><AppShell audience="internal"><div /></AppShell></MemoryRouter>);
    expect(screen.getAllByRole("link", { name: "Knowledge Base" }).length).toBeGreaterThan(0);
  });

  it("renders semantic desktop columns and keeps mobile cards available", () => {
    const view = renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    const table = screen.getByRole("table");
    for (const name of ["Title", "Category", "Status", "Updated", "Author"]) {
      expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(view.container.querySelectorAll('a[href="/knowledge-base/article-1"]').length).toBeGreaterThanOrEqual(2);
  });

  it("keeps long titles contained with an accessible full-text label", () => {
    renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    const link = within(screen.getByRole("table")).getByRole("link", { name: longTitle });
    expect(link).toHaveAttribute("title", longTitle);
    expect(link.className).toContain("line-clamp-2");
  });

  it("submits the correct server query for search", async () => {
    renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    fireEvent.change(screen.getByPlaceholderText("Search articles by title, content, or category…"), { target: { value: "refund" } });
    await waitFor(() => expect(mocks.useKnowledgeArticles).toHaveBeenLastCalledWith(expect.objectContaining({ search: "refund" })), { timeout: 1000 });
  });

  it("submits the correct server query for the status filter", async () => {
    renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "DRAFT" } });
    await waitFor(() => expect(mocks.useKnowledgeArticles).toHaveBeenLastCalledWith(expect.objectContaining({ status: "DRAFT" })));
  });

  it("submits the correct server query for the category filter", async () => {
    renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    fireEvent.change(screen.getByPlaceholderText("Category filter"), { target: { value: "Billing" } });
    await waitFor(() => expect(mocks.useKnowledgeArticles).toHaveBeenLastCalledWith(expect.objectContaining({ category: "Billing" })), { timeout: 1000 });
  });

  it("keeps pagination server-backed and URL-driven", async () => {
    mocks.useKnowledgeArticles.mockReturnValue({ isLoading: false, isError: false, data: { data: [listItem], meta: { page: 2, limit: 20, total: 60, totalPages: 3 } }, refetch: vi.fn() });
    renderAt("/knowledge-base?page=2", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    expect(mocks.useKnowledgeArticles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 20 }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(mocks.useKnowledgeArticles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })));
  });

  it("renders loading, error with retry, empty, and no-results states", () => {
    mocks.useKnowledgeArticles.mockReturnValueOnce({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    const loading = renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
    loading.unmount();

    const refetch = vi.fn();
    mocks.useKnowledgeArticles.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch });
    const errored = renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    expect(screen.getByText("Unable to load knowledge base articles.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
    errored.unmount();

    mocks.useKnowledgeArticles.mockReturnValue({ isLoading: false, isError: false, data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, refetch: vi.fn() });
    const empty = renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    expect(screen.getByText("No knowledge base articles yet.")).toBeInTheDocument();
    empty.unmount();

    renderAt("/knowledge-base?search=none", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    expect(screen.getByText("No articles match the current search or filters.")).toBeInTheDocument();
  });

  it.each(["ADMIN", "MANAGER"] as const)("shows Create Article for %s and hides it for AGENT", (role) => {
    mocks.role = role;
    const view = renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    expect(screen.getByRole("link", { name: "Create article" })).toHaveAttribute("href", "/knowledge-base/new");
    view.unmount();

    mocks.role = "AGENT";
    renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    expect(screen.queryByRole("link", { name: "Create article" })).not.toBeInTheDocument();
  });

  it("validates required fields and never sends createdById on create", async () => {
    mocks.create.mockResolvedValue({ id: "new-article" });
    renderAt("/knowledge-base/new", <>
      <Route path="/knowledge-base/new" element={<KnowledgeArticleFormPage />} />
      <Route path="/knowledge-base/:id" element={<LocationProbe />} />
    </>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Title must be at least 3 characters")).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Article title/), { target: { value: "Reset your password" } });
    fireEvent.change(screen.getByLabelText(/Article content/), { target: { value: "Detailed steps." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    const payload = mocks.create.mock.calls[0][0];
    expect(payload).toMatchObject({ title: "Reset your password", content: "Detailed steps.", status: "DRAFT" });
    expect(payload).not.toHaveProperty("createdById");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/knowledge-base/new-article"));
  });

  it("loads existing values into the edit form and sends only approved fields", async () => {
    mocks.update.mockResolvedValue({ id: "article-1" });
    renderAt("/knowledge-base/article-1/edit", <Route path="/knowledge-base/:id/edit" element={<KnowledgeArticleFormPage />} />);
    expect(screen.getByDisplayValue("Reset your password")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Accounts")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(Object.keys(mocks.update.mock.calls[0][0]).sort()).toEqual(["category", "content", "status", "title"]);
  });

  it("prevents duplicate submissions while a save is pending", () => {
    mocks.useCreateKnowledgeArticle.mockReturnValue({ mutateAsync: mocks.create, isPending: true });
    renderAt("/knowledge-base/new", <Route path="/knowledge-base/new" element={<KnowledgeArticleFormPage />} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("renders article content safely as plain text", () => {
    const view = renderAt("/knowledge-base/article-1", <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetailPage />} />);
    expect(screen.getByText(/Step one\. Do this\./)).toBeInTheDocument();
    expect(screen.getByText(/stays literal/)).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
  });

  it("lets AGENT read an article without management controls", () => {
    mocks.role = "AGENT";
    renderAt("/knowledge-base/article-1", <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetailPage />} />);
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.getByText(/Step one/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit article" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete article" })).not.toBeInTheDocument();
  });

  it.each(["ADMIN", "MANAGER"] as const)("keeps Edit and Delete for %s and confirms before deleting", async (role) => {
    mocks.role = role;
    mocks.remove.mockResolvedValue(undefined);
    renderAt("/knowledge-base/article-1", <>
      <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetailPage />} />
      <Route path="/knowledge-base" element={<LocationProbe />} />
    </>);
    expect(screen.getByRole("link", { name: "Edit article" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete article" }));
    expect(screen.getByText(/This permanently deletes the article/)).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("article-1"));
  });

  it("cancels delete without any mutation", () => {
    renderAt("/knowledge-base/article-1", <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetailPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete article" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/This permanently deletes the article/)).not.toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("prevents duplicate delete requests while pending", () => {
    mocks.useDeleteKnowledgeArticle.mockReturnValue({ mutateAsync: mocks.remove, isPending: true });
    renderAt("/knowledge-base/article-1", <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetailPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete article" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });

  it("keeps the current article visible when a delete fails", async () => {
    mocks.remove.mockRejectedValue(new Error("network"));
    renderAt("/knowledge-base/article-1", <Route path="/knowledge-base/:id" element={<KnowledgeBaseDetailPage />} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete article" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByText("Unable to delete the article.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });

  it("renders the list in Arabic with RTL document direction", async () => {
    await changeAppLanguage("ar");
    renderAt("/knowledge-base", <Route path="/knowledge-base" element={<KnowledgeBaseListPage />} />);
    expect(screen.getByRole("heading", { name: "قاعدة المعرفة" })).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "العنوان" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });
});
