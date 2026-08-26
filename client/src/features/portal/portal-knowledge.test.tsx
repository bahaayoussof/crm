import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ useArticles: vi.fn(), useArticle: vi.fn() }));
vi.mock("./portal-hooks", () => ({
  usePortalKnowledgeArticles: mocks.useArticles,
  usePortalKnowledgeArticle: mocks.useArticle,
}));

import { PortalKnowledgeArticlePage, PortalKnowledgeBasePage } from "./portal-knowledge-pages";

const article = { id: "article-1", title: "How billing works", category: "Billing", updatedAt: "2026-08-25T10:00:00.000Z", excerpt: "A short summary of how billing works." };
const detail = { id: "article-1", title: "How billing works", content: "Billing runs monthly.\n\nContact support for changes.", category: "Billing", updatedAt: "2026-08-25T10:00:00.000Z" };

function renderAt(path: string, route: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>{route}</Routes></MemoryRouter>);
}

describe("portal knowledge base", () => {
  afterEach(cleanup);
  beforeEach(async () => {
    await changeAppLanguage("en");
    vi.clearAllMocks();
    mocks.useArticles.mockReturnValue({ isLoading: false, isError: false, data: { data: [article], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } }, refetch: vi.fn() });
    mocks.useArticle.mockReturnValue({ isLoading: false, isError: false, data: detail, refetch: vi.fn() });
  });

  it("renders published article data without internal controls", () => {
    renderAt("/portal/knowledge-base", <Route path="/portal/knowledge-base" element={<PortalKnowledgeBasePage />} />);
    expect(screen.getByRole("heading", { name: "Help Center" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /How billing works/ })).toHaveAttribute("href", "/portal/knowledge-base/article-1");
    expect(screen.getByText("A short summary of how billing works.")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
  });

  it("submits the correct portal search query", async () => {
    renderAt("/portal/knowledge-base", <Route path="/portal/knowledge-base" element={<PortalKnowledgeBasePage />} />);
    fireEvent.change(screen.getByPlaceholderText("Search for help…"), { target: { value: "vpn" } });
    await waitFor(() => expect(mocks.useArticles).toHaveBeenLastCalledWith(expect.objectContaining({ search: "vpn" })));
  });

  it("renders empty and no-results states", () => {
    mocks.useArticles.mockReturnValue({ isLoading: false, isError: false, data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }, refetch: vi.fn() });
    const empty = renderAt("/portal/knowledge-base", <Route path="/portal/knowledge-base" element={<PortalKnowledgeBasePage />} />);
    expect(screen.getByText("No help articles are available yet.")).toBeInTheDocument();
    empty.unmount();

    renderAt("/portal/knowledge-base?search=zzz", <Route path="/portal/knowledge-base" element={<PortalKnowledgeBasePage />} />);
    expect(screen.getByText("No help articles match your search.")).toBeInTheDocument();
  });

  it("renders article detail content and never shows author or status", () => {
    const view = renderAt("/portal/knowledge-base/article-1", <Route path="/portal/knowledge-base/:id" element={<PortalKnowledgeArticlePage />} />);
    expect(screen.getByRole("heading", { name: "How billing works" })).toBeInTheDocument();
    expect(screen.getByText(/Billing runs monthly/)).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
    expect(screen.queryByText(/Author/)).not.toBeInTheDocument();
  });

  it("shows a not-found state for an unpublished or missing article", () => {
    mocks.useArticle.mockReturnValue({ isLoading: false, isError: true, error: { isAxiosError: true, response: { data: { error: { code: "KNOWLEDGE_ARTICLE_NOT_FOUND" } } } }, refetch: vi.fn() });
    renderAt("/portal/knowledge-base/missing", <Route path="/portal/knowledge-base/:id" element={<PortalKnowledgeArticlePage />} />);
    expect(screen.getByText("This article was not found.")).toBeInTheDocument();
  });

  it("renders the help center in Arabic", async () => {
    await changeAppLanguage("ar");
    renderAt("/portal/knowledge-base", <Route path="/portal/knowledge-base" element={<PortalKnowledgeBasePage />} />);
    expect(screen.getByRole("heading", { name: "مركز المساعدة" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });
});
