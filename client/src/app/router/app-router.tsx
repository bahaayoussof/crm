import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FoundationPage } from "@/app/router/foundation-page";

export function AppRouter() {
  return <BrowserRouter><Routes><Route path="*" element={<FoundationPage />} /></Routes></BrowserRouter>;
}
