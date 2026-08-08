import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppRoutes } from "@/routes/AppRoutes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { loadGoogleTranslate } from "@/lib/googleTranslate";
import { queryClient } from "@/lib/queryClient";

export function App() {
  // Mounted once at the root (never unmounted by routing) so the widget's
  // MutationObserver keeps translating content across client-side navigation.
  useEffect(() => {
    loadGoogleTranslate();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <BrowserRouter>
              <AuthProvider>
                <NotificationsProvider>
                  <div id="google_translate_element" />
                  <AppRoutes />
                </NotificationsProvider>
              </AuthProvider>
            </BrowserRouter>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
