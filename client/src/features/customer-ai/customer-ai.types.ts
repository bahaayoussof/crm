export interface CustomerAiMessage { role: "user" | "assistant"; content: string }
export interface CustomerAiArticle { id: string; title: string; category: string | null; excerpt: string }
export interface CustomerAiResponse { answer: string; confidence: number; suggestedArticles: CustomerAiArticle[]; canHandoff: boolean }
