import axios from "axios";

export function getAuthErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data.error?.message ?? "Unable to complete the request";
  }
  return "Unable to complete the request";
}
