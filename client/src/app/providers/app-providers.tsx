import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useState } from "react";
import { AuthProvider } from "@/features/auth/auth-context";
import { DemoBanner } from "@/components/shared/demo-banner";
import { ThemeProvider } from "@/lib/theme-provider";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <DemoBanner />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
