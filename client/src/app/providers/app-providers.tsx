import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useState } from "react";
import { AuthProvider } from "@/features/auth/auth-context";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={queryClient}><LanguageSwitcher /><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
