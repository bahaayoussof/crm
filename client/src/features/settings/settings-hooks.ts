import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSettingCategory, getSettingCategories, getSlaRules, putSlaRule, updateSettingCategory } from "./settings-api";
import type { CategoryInput, Priority, SlaInput } from "./settings.types";
export const settingsKeys = { all: ["settings"] as const, categories: (search: string) => ["settings", "categories", search] as const, sla: ["settings", "sla-rules"] as const };
export const useSettingCategories = (search: string) => useQuery({ queryKey: settingsKeys.categories(search), queryFn: () => getSettingCategories(search) });
export const useSlaRules = () => useQuery({ queryKey: settingsKeys.sla, queryFn: getSlaRules });
export function useCreateCategory() { const q = useQueryClient(); return useMutation({ mutationFn: createSettingCategory, onSuccess: () => q.invalidateQueries({ queryKey: settingsKeys.all }) }); }
export function useUpdateCategory() { const q = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: CategoryInput }) => updateSettingCategory(id, input), onSuccess: () => Promise.all([q.invalidateQueries({ queryKey: settingsKeys.all }), q.invalidateQueries({ queryKey: ["categories"] })]) }); }
export function usePutSlaRule() { const q = useQueryClient(); return useMutation({ mutationFn: ({ priority, input }: { priority: Priority; input: SlaInput }) => putSlaRule(priority, input), onSuccess: () => q.invalidateQueries({ queryKey: settingsKeys.sla }) }); }
