import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./portal-api";
import type { PortalFilters, PortalKnowledgeFilters } from "./portal.types";
export const portalKeys = {
  all: ["portal"] as const,
  overview: ["portal", "overview"] as const,
  categories: ["portal", "categories"] as const,
  tickets: (filters?: PortalFilters) => ["portal", "tickets", ...(filters ? [filters] : [])] as const,
  ticket: (id: string) => ["portal", "tickets", id] as const,
  knowledgeArticles: (filters?: PortalKnowledgeFilters) => ["portal", "knowledge-articles", ...(filters ? [filters] : [])] as const,
  knowledgeArticle: (id: string) => ["portal", "knowledge-articles", id] as const,
};
export const usePortalOverview = () => useQuery({ queryKey: portalKeys.overview, queryFn: api.getPortalOverview });
export const usePortalCategories = () => useQuery({ queryKey: portalKeys.categories, queryFn: api.getPortalCategories });
export const usePortalTickets = (filters: PortalFilters) => useQuery({ queryKey: portalKeys.tickets(filters), queryFn: () => api.getPortalTickets(filters) });
export const usePortalTicket = (id: string) => useQuery({ queryKey: portalKeys.ticket(id), queryFn: () => api.getPortalTicket(id), retry: false });
export function useCreatePortalTicket() { const qc = useQueryClient(); return useMutation({ mutationFn: api.createPortalTicket, onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: portalKeys.overview }), qc.invalidateQueries({ queryKey: portalKeys.tickets() })]); } }); }
export function useReplyPortalTicket(id: string) { const qc = useQueryClient(); return useMutation({ mutationFn: (body: string) => api.replyPortalTicket({ id, body }), onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: portalKeys.ticket(id) }), qc.invalidateQueries({ queryKey: portalKeys.overview }), qc.invalidateQueries({ queryKey: portalKeys.tickets() })]); } }); }
export function useSubmitPortalFeedback(id: string) { const qc = useQueryClient(); return useMutation({ mutationFn: (input: { rating: number; comment?: string }) => api.submitPortalFeedback({ id, ...input }), onSuccess: async () => { await qc.invalidateQueries({ queryKey: portalKeys.ticket(id) }); } }); }
export const usePortalKnowledgeArticles = (filters: PortalKnowledgeFilters) => useQuery({ queryKey: portalKeys.knowledgeArticles(filters), queryFn: () => api.getPortalKnowledgeArticles(filters) });
export const usePortalKnowledgeArticle = (id: string) => useQuery({ queryKey: portalKeys.knowledgeArticle(id), queryFn: () => api.getPortalKnowledgeArticle(id), retry: false });
