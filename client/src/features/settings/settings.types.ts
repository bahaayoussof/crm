export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export interface SettingCategory { id: string; name: string; description: string | null; isActive: boolean; createdAt: string; updatedAt: string }
export interface SlaRule { id: string; priority: Priority; firstResponseMinutes: number; resolutionMinutes: number; isActive: boolean; createdAt: string; updatedAt: string }
export interface CategoryInput { name?: string; description?: string; isActive?: boolean }
export interface SlaInput { firstResponseMinutes: number; resolutionMinutes: number; isActive: boolean }
