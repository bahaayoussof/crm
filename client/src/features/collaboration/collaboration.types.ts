// feature/team-collaboration (ADR-032) — internal mentions + ticket watchers.

export interface MentionableUser {
  id: string;
  name: string;
  email: string;
}

export interface TicketWatcher {
  id: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export interface WatchState {
  watching: boolean;
  watcherCount: number;
}
