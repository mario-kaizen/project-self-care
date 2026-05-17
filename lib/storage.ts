import type { User, Session, Program, SetLog } from "./types";

const USER_KEY = "selfcare:user";
const SESSIONS_KEY = "selfcare:sessions";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function uuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSessions(): Session[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(SESSIONS_KEY);
  return raw ? (JSON.parse(raw) as Session[]) : [];
}

export function saveSession(session: Session): void {
  const sessions = getSessions();
  const i = sessions.findIndex((s) => s.id === session.id);
  if (i >= 0) sessions[i] = session;
  else sessions.push(session);
  sessions.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getOrCreateTodaySession(user: User, program: Program): Session {
  const sessions = getSessions();
  const today = todayISO();
  const existing = sessions.find((s) => s.date === today);
  if (existing) return existing;

  const start = new Date(user.startDate + "T00:00:00").getTime();
  const now = new Date(today + "T00:00:00").getTime();
  const dayIndex = Math.max(0, Math.floor((now - start) / 86400000));
  const programDay = program.days[dayIndex % program.days.length];

  const session: Session = {
    id: uuid(),
    date: today,
    type: programDay.type,
    plan: programDay.exercises,
    completed: false,
    completedAt: null,
    preWord: null,
    postWord: null,
  };
  saveSession(session);
  return session;
}

export function getLastForExercise(exerciseName: string): SetLog[] | null {
  const sessions = getSessions().slice().reverse();
  for (const s of sessions) {
    const log = s.actuals?.[exerciseName];
    if (log && log.sets.length > 0) return log.sets;
  }
  return null;
}

export function getRecentSessions(days: number): Session[] {
  const sessions = getSessions();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  return sessions.filter((s) => s.date >= cutoffISO);
}

export function getLastSevenDays(): { date: string; completed: boolean; type: string }[] {
  const result: { date: string; completed: boolean; type: string }[] = [];
  const sessions = getSessions();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const s = sessions.find((x) => x.date === iso);
    result.push({
      date: iso,
      completed: s?.completed ?? false,
      type: s?.type ?? "none",
    });
  }
  return result;
}
