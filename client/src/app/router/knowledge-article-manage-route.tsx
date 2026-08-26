import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { canManageKnowledgeArticles } from "@/features/knowledge-base/knowledge-article-permissions";

export function KnowledgeArticleManageRoute() {
  const { user } = useAuth();
  return user && canManageKnowledgeArticles(user.role) ? <Outlet /> : <Navigate to="/knowledge-base" replace />;
}
