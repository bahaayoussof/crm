import axios from "axios";
import { clearAuthToken, getAuthToken } from "@/features/auth/auth-token";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(undefined, (error) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && getAuthToken()) {
    clearAuthToken();
    window.dispatchEvent(new Event("auth:unauthorized"));
  }
  return Promise.reject(error);
});
