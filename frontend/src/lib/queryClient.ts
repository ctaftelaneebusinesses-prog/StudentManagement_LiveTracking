import { QueryClient } from "@tanstack/react-query";

/**
 * Single app-wide QueryClient instance. Exported (rather than defined inline
 * in App.tsx) so AuthContext can clear it on login/logout — see the note
 * there for why that matters: without it, cached data from one signed-in
 * user's session (e.g. a super_admin's full school list) can be shown to the
 * next user who logs in in the same browser tab, for up to `staleTime`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Dashboard data doesn't change second-to-second — treating it as
      // fresh for 30s avoids a refetch waterfall every time a user tabs
      // between pages that share a query key (e.g. the class/student
      // pickers reused across attendance, marks, and reports).
      staleTime: 30 * 1000,
    },
  },
});
