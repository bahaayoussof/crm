import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export interface NavChildItem {
  to: string;
  key: string;
  label?: string;
  badge?: string | number;
}

export interface NavItemConfig {
  to: string;
  key: string;
  icon: ComponentType<LucideProps>;
  label?: string;
  badge?: string | number;
  /** Pass-through to React Router `NavLink` — exact-match active state. */
  end?: boolean;
  children?: NavChildItem[];
}

export interface NavSectionConfig {
  id: string;
  labelKey?: string;
  label?: string;
  items: NavItemConfig[];
}
