import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { CategoryInput, Priority, SettingCategory, SlaInput, SlaRule } from "./settings.types";
export async function getSettingCategories(search = "") { return (await apiClient.get<ApiEnvelope<SettingCategory[]>>("/settings/categories", { params: { search } })).data.data; }
export async function createSettingCategory(input: Required<Pick<CategoryInput, "name">> & CategoryInput) { return (await apiClient.post<ApiEnvelope<SettingCategory>>("/settings/categories", input)).data.data; }
export async function updateSettingCategory(id: string, input: CategoryInput) { return (await apiClient.patch<ApiEnvelope<SettingCategory>>(`/settings/categories/${id}`, input)).data.data; }
export async function getSlaRules() { return (await apiClient.get<ApiEnvelope<SlaRule[]>>("/settings/sla-rules")).data.data; }
export async function putSlaRule(priority: Priority, input: SlaInput) { return (await apiClient.put<ApiEnvelope<SlaRule>>(`/settings/sla-rules/${priority}`, input)).data.data; }
