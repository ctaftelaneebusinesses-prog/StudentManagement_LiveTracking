import axios from "axios";
import { supabase } from "./supabaseClient";

/**
 * Axios instance for calling our own backend API (not Supabase directly).
 * Attaches the current Supabase access token as a Bearer header on every
 * request, so the backend's requireAuth middleware can verify identity and
 * build a request-scoped, RLS-respecting Supabase client.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Session is invalid/expired server-side — clear it and send the user
      // back to login. A hard redirect (not react-router) since this file
      // lives outside the component tree.
      await supabase.auth.signOut();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);
