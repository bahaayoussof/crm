import type { ReactNode } from "react";

export function AuthField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="block text-sm font-medium">{label}<span className="mt-2 block">{children}</span>{error && <span className="mt-1 block text-sm text-red-600">{error}</span>}</label>;
}
