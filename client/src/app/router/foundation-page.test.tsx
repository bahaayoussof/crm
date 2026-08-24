import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { FoundationPage } from "@/app/router/foundation-page";
import "@/lib/i18n";

it("renders the project foundation placeholder", () => {
  render(<FoundationPage />);
  expect(screen.getByRole("heading", { name: "Customer Support CRM" })).toBeInTheDocument();
  expect(screen.getByText("Project foundation is ready.")).toBeInTheDocument();
});
