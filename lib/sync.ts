import type { User, Session } from "./types";
import { getUser, setUser, getSessions } from "./storage";

const SECRET_KEY = "selfcare:secret";
const SESSIONS_KEY = "selfcare:sessions";

export function getSecret(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SECRET_KEY);
}

export function setSecret(s: string): void {
  localStorage.setItem(SECRET_KEY, s);
}

export function clearSecret(): void {
  localStorage.removeItem(SECRET_KEY);
}

type RemoteState = {
  user: User | null;
  sessions: Session[];
  updatedAt: string | null;
};

export async function pullRemote(): Promise<RemoteState | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const r = await fetch("/api/sync", {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (r.status === 401) {
      clearSecret();
      return null;
    }
    if (!r.ok) return null;
    return (await r.json()) as RemoteState;
  } catch {
    return null;
  }
}

export async function pushRemote(user: User | null, sessions: Session[]): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  try {
    const r = await fetch("/api/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user, sessions }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function sessionScore(s: Session): number {
  let score = 0;
  if (s.completed) score += 1_000_000;
  if (s.completedAt) score += new Date(s.completedAt).getTime() / 1_000;
  if (s.preWord) score += 100;
  if (s.postWord) score += 100;
  for (const log of Object.values(s.actuals ?? {})) {
    score += log.sets.filter((set) => set.weight !== null || set.reps !== null).length * 10;
    if (log.notes) score += 50;
  }
  return score;
}

export function mergeSessions(local: Session[], remote: Session[]): Session[] {
  const byDate = new Map<string, Session>();
  for (const s of remote) byDate.set(s.date, s);
  for (const s of local) {
    const r = byDate.get(s.date);
    if (!r) byDate.set(s.date, s);
    else byDate.set(s.date, sessionScore(s) >= sessionScore(r) ? s : r);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function applyMerge(remote: RemoteState): { user: User | null; sessions: Session[] } {
  const localUser = getUser();
  const localSessions = getSessions();
  const user = localUser ?? remote.user ?? null;
  const sessions = mergeSessions(localSessions, remote.sessions ?? []);
  if (user) setUser(user);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  return { user, sessions };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePush(): void {
  if (!getSecret()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushRemote(getUser(), getSessions());
  }, 800);
}
