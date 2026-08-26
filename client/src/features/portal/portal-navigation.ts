export type PortalNavigationKey = "home" | "requests" | "newRequest";

export function getPortalNavigationKey(pathname: string): PortalNavigationKey {
  if (pathname === "/portal/tickets/new") return "newRequest";
  if (pathname === "/portal/tickets" || /^\/portal\/tickets\/[^/]+\/?$/.test(pathname)) return "requests";
  return "home";
}
