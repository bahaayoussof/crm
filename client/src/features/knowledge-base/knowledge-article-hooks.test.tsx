import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./knowledge-article-api", () => ({
  createKnowledgeArticle: vi.fn().mockResolvedValue({ id: "article-1" }),
  updateKnowledgeArticle: vi.fn().mockResolvedValue({ id: "article-1" }),
  deleteKnowledgeArticle: vi.fn().mockResolvedValue(undefined),
  getKnowledgeArticle: vi.fn(),
  getKnowledgeArticles: vi.fn(),
}));

import { useCreateKnowledgeArticle, useDeleteKnowledgeArticle, useUpdateKnowledgeArticle } from "./knowledge-article-hooks";

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { spy, wrapper };
}

const invalidatedPortalKnowledge = (calls: unknown[][]) =>
  calls.some(([arg]) => JSON.stringify((arg as { queryKey?: unknown[] })?.queryKey) === JSON.stringify(["portal", "knowledge-articles"]));

describe("knowledge article mutation cache invalidation", () => {
  afterEach(() => vi.clearAllMocks());

  it("invalidates internal and portal knowledge queries after create", async () => {
    const { spy, wrapper } = harness();
    const { result } = renderHook(() => useCreateKnowledgeArticle(), { wrapper });
    await result.current.mutateAsync({ title: "New article", content: "Body", category: "", status: "PUBLISHED" });
    await waitFor(() => expect(invalidatedPortalKnowledge(spy.mock.calls)).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["knowledge-articles", "list"] }));
  });

  it("invalidates portal knowledge queries after publish/unpublish update", async () => {
    const { spy, wrapper } = harness();
    const { result } = renderHook(() => useUpdateKnowledgeArticle("article-1"), { wrapper });
    await result.current.mutateAsync({ title: "New article", content: "Body", category: "", status: "DRAFT" });
    await waitFor(() => expect(invalidatedPortalKnowledge(spy.mock.calls)).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["knowledge-articles", "detail", "article-1"] }));
  });

  it("invalidates portal knowledge queries after delete", async () => {
    const { spy, wrapper } = harness();
    const { result } = renderHook(() => useDeleteKnowledgeArticle(), { wrapper });
    await result.current.mutateAsync("article-1");
    await waitFor(() => expect(invalidatedPortalKnowledge(spy.mock.calls)).toBe(true));
  });
});
