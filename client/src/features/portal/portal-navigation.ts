export type PortalNavigationKey = "home" | "requests" | "newRequest" | "knowledgeBase";

export function getPortalNavigationKey(pathname: string): PortalNavigationKey {
  if (pathname === "/portal/tickets/new") return "newRequest";
  if (pathname === "/portal/tickets" || /^\/portal\/tickets\/[^/]+\/?$/.test(pathname)) return "requests";
  if (pathname === "/portal/knowledge-base" || /^\/portal\/knowledge-base\/[^/]+\/?$/.test(pathname)) return "knowledgeBase";
  return "home";
}
