import type { ComponentType, SVGProps } from "react";

export interface NavChildItem {
  to: string;
  key: string;
  label?: string;
  badge?: string | number;
}

export interface NavItemConfig {
  to: string;
  key: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label?: string;
  badge?: string | number;
  children?: NavChildItem[];
}

export interface NavSectionConfig {
  id: string;
  labelKey?: string;
  label?: string;
  items: NavItemConfig[];
}
