import type { ReactNode } from "react";

export function AuthField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return <div>
    <label className="block text-sm font-medium text-foreground" htmlFor={id}>{label}</label>
    <div className="mt-2">{children}</div>
    {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">{error}</p>}
  </div>;
}
