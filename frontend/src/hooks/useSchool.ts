import { useContext } from "react";
import { SchoolContext } from "@/context/SchoolContext";

export function useSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) {
    throw new Error("useSchool must be used within a SchoolProvider");
  }
  return ctx;
}
