import { create } from "zustand";

const STORAGE_KEY = "sms-selected-school";

interface SchoolStoreState {
  selectedSchoolId: string | null;
  setSelectedSchoolId: (id: string) => void;
}

/**
 * Holds just the selected-school id, persisted to localStorage. This is a
 * Zustand store (not React Context) specifically so `lib/axios.ts` can read
 * the current selection outside of React via `useSchoolStore.getState()` and
 * attach it to every request. The actual `School` objects/list live in
 * `SchoolContext` (React Query-backed), which reads/writes this store.
 */
export const useSchoolStore = create<SchoolStoreState>((set) => ({
  selectedSchoolId: typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null,
  setSelectedSchoolId: (id) => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
    set({ selectedSchoolId: id });
  },
}));
