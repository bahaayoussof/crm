import { describe, expect, it } from "vitest";
import { getProtectedRedirect, getRoleHome } from "./auth-routing";
import type { AuthUser } from "./auth.types";

const user = (role: AuthUser["role"]): AuthUser => ({ id: "user-1", name: "Test User", email: "test@example.com", role, customer: null });

describe("authentication routing", () => {
  it("maps customers to the portal and internal roles to the dashboard", () => {
    expect(getRoleHome("CUSTOMER")).toBe("/portal");
    expect(getRoleHome("ADMIN")).toBe("/dashboard");
    expect(getRoleHome("MANAGER")).toBe("/dashboard");
    expect(getRoleHome("AGENT")).toBe("/dashboard");
  });

  it("protects routes and redirects a signed-in user to their role area", () => {
    expect(getProtectedRedirect(null, "internal")).toBe("/login");
    expect(getProtectedRedirect(user("CUSTOMER"), "internal")).toBe("/portal");
    expect(getProtectedRedirect(user("ADMIN"), "internal")).toBeNull();
    expect(getProtectedRedirect(user("MANAGER"), "internal")).toBeNull();
    expect(getProtectedRedirect(user("AGENT"), "internal")).toBeNull();
    expect(getProtectedRedirect(user("AGENT"), "customer")).toBe("/dashboard");
    expect(getProtectedRedirect(user("CUSTOMER"), "customer")).toBeNull();
  });
});
