"use client";

import { useEffect, useState } from "react";
import type { User, Session, Program, Exercise, SetLog } from "@/lib/types";
import {
  getUser,
  setUser as persistUser,
  getOrCreateTodaySession,
  saveSession,
  getLastForExercise,
  getLastSevenDays,
} from "@/lib/storage";
import {
  getSecret,
  setSecret,
  pullRemote,
  applyMerge,
  schedulePush,
} from "@/lib/sync";

const EQUIPMENT_OPTIONS = [
  "Squat rack",
  "Barbell + plates",
  "Bench",
  "Dumbbells",
  "Bands",
  "Concept2",
];

export default function Home() {
  const [hasSecret, setHasSecret] = useState<boolean>(false);
  const [user, setUserState] = useState<User | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      setHasSecret(Boolean(getSecret()));
      const programResp = await fetch("/program.json").then((r) => r.json());
      setProgram(programResp);

      if (getSecret()) {
        const remote = await pullRemote();
        if (remote) applyMerge(remote);
      }

      const u = getUser();
      setUserState(u);
      if (u) setSession(getOrCreateTodaySession(u, programResp));
      setReady(true);
    })();
  }, []);

  if (!ready) return <main className="min-h-screen paper-grain" />;

  if (!hasSecret) {
    return (
      <Passphrase
        onUnlock={async (secret) => {
          setSecret(secret);
          setHasSecret(true);
          const remote = await pullRemote();
          if (remote) applyMerge(remote);
          const u = getUser();
          setUserState(u);
          if (u && program) setSession(getOrCreateTodaySession(u, program));
        }}
      />
    );
  }

  if (!user || !program) {
    return (
      <Setup
        onDone={(u) => {
          persistUser(u);
          setUserState(u);
          setSession(getOrCreateTodaySession(u, program!));
          schedulePush();
        }}
      />
    );
  }

  if (!session) return null;

  return (
    <Today
      session={session}
      onChange={(s) => {
        saveSession(s);
        setSession({ ...s });
        schedulePush();
      }}
    />
  );
}

/* ---------- Passphrase ---------- */

function Passphrase({ onUnlock }: { onUnlock: (s: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const attempt = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/sync", {
        headers: { Authorization: `Bearer ${trimmed}` },
        cache: "no-store",
      });
      if (r.status === 401) {
        setError("that passphrase didn't unlock it.");
        setPending(false);
        return;
      }
      if (!r.ok) {
        setError("couldn't reach the server.");
        setPending(false);
        return;
      }
      await onUnlock(trimmed);
    } catch {
      setError("couldn't reach the server.");
      setPending(false);
    }
  };

  return (
    <main className="paper-grain min-h-screen flex items-center justify-center px-8 py-16">
      <div className="relative z-10 max-w-sm w-full fade-in">
        <header className="mb-10">
          <p className="font-display italic text-ink-faded text-base mb-3">
            welcome back
          </p>
          <h1 className="font-display text-4xl leading-[1.05] text-ink tracking-tight">
            Project
            <br />
            <span className="italic">Self Care</span>
          </h1>
          <p className="mt-6 text-ink-soft text-[0.95rem] leading-relaxed">
            Your sync passphrase keeps your history with you across devices.
            Paste it once on each device you use.
          </p>
        </header>

        <div className="space-y-2 mb-3">
          <p className="font-display italic text-ink-faded text-sm">
            passphrase
          </p>
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") attempt();
            }}
            placeholder="paste it here…"
            className="input-journal"
          />
          {error && (
            <p className="font-display italic text-sm text-ink-soft pt-2">
              {error}
            </p>
          )}
        </div>

        <button
          onClick={attempt}
          disabled={pending || !value.trim()}
          className="w-full mt-8 py-4 border border-ink text-ink font-display italic text-xl tracking-wide active:bg-ink active:text-paper transition-colors disabled:opacity-40"
        >
          {pending ? "unlocking…" : "unlock"}
        </button>
      </div>
    </main>
  );
}

/* ---------- Setup ---------- */

function Setup({ onDone }: { onDone: (u: User) => void }) {
  const [equipment, setEquipment] = useState<string[]>(EQUIPMENT_OPTIONS);

  return (
    <main className="paper-grain min-h-screen flex items-center justify-center px-8 py-16">
      <div className="relative z-10 max-w-sm w-full">
        <header className="mb-12 fade-in">
          <p className="font-display italic text-ink-faded text-base mb-3">
            welcome
          </p>
          <h1 className="font-display text-4xl leading-[1.05] text-ink tracking-tight">
            Project
            <br />
            <span className="italic">Self Care</span>
          </h1>
          <p className="mt-6 text-ink-soft text-[0.95rem] leading-relaxed">
            Coming home to yourself, one session at a time. Today is day one.
          </p>
        </header>

        <div className="mb-10 fade-in" style={{ animationDelay: "120ms" }}>
          <p className="font-display italic text-ink-faded text-sm mb-4 tracking-wide">
            equipment you have
          </p>
          <ul className="space-y-1">
            {EQUIPMENT_OPTIONS.map((item) => {
              const on = equipment.includes(item);
              return (
                <li key={item}>
                  <button
                    onClick={() =>
                      setEquipment(
                        on
                          ? equipment.filter((x) => x !== item)
                          : [...equipment, item],
                      )
                    }
                    className="w-full flex items-center justify-between py-3 border-b border-line-soft text-left"
                  >
                    <span
                      className={`text-base transition-colors ${
                        on ? "text-ink" : "text-ink-faded"
                      }`}
                    >
                      {item}
                    </span>
                    <span
                      className={`font-mono text-xs transition-opacity ${
                        on ? "text-moss opacity-100" : "opacity-0"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          onClick={() =>
            onDone({
              startDate: new Date().toISOString().slice(0, 10),
              equipment,
            })
          }
          className="fade-in w-full py-4 border border-ink text-ink font-display italic text-xl tracking-wide active:bg-ink active:text-paper transition-colors"
          style={{ animationDelay: "240ms" }}
        >
          begin
        </button>
      </div>
    </main>
  );
}

/* ---------- Today ---------- */

function Today({
  session,
  onChange,
}: {
  session: Session;
  onChange: (s: Session) => void;
}) {
  const updatePreWord = (word: string) => {
    onChange({ ...session, preWord: word.trim() || null });
  };

  const finishSession = (postWord: string) => {
    onChange({
      ...session,
      postWord: postWord.trim() || null,
      completed: true,
      completedAt: new Date().toISOString(),
    });
  };

  const updateSet = (
    exName: string,
    setIndex: number,
    field: "weight" | "reps",
    value: number | null,
  ) => {
    const actuals = { ...(session.actuals ?? {}) };
    const log = actuals[exName] ?? { sets: [] };
    const sets = [...log.sets];
    while (sets.length <= setIndex) {
      sets.push({ set: sets.length + 1, weight: null, reps: null });
    }
    sets[setIndex] = { ...sets[setIndex], [field]: value };
    actuals[exName] = { ...log, sets };
    onChange({ ...session, actuals });
  };

  const toggleBodyweightSet = (exName: string, setIndex: number) => {
    const actuals = { ...(session.actuals ?? {}) };
    const log = actuals[exName] ?? { sets: [] };
    const sets = [...log.sets];
    while (sets.length <= setIndex) {
      sets.push({ set: sets.length + 1, weight: null, reps: 1 });
    }
    const done = sets[setIndex].reps !== null;
    sets[setIndex] = { ...sets[setIndex], reps: done ? null : 1 };
    actuals[exName] = { ...log, sets };
    onChange({ ...session, actuals });
  };

  const addSet = (exName: string) => {
    const actuals = { ...(session.actuals ?? {}) };
    const log = actuals[exName] ?? { sets: [] };
    const last = log.sets[log.sets.length - 1];
    const newSet: SetLog = {
      set: log.sets.length + 1,
      weight: last?.weight ?? null,
      reps: last?.reps ?? null,
    };
    actuals[exName] = { ...log, sets: [...log.sets, newSet] };
    onChange({ ...session, actuals });
  };

  const updateNotes = (exName: string, notes: string) => {
    const actuals = { ...(session.actuals ?? {}) };
    const log = actuals[exName] ?? { sets: [] };
    actuals[exName] = { ...log, notes };
    onChange({ ...session, actuals });
  };

  const date = new Date(session.date + "T00:00:00");
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const dayMonth = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });

  if (session.type === "rest") {
    return (
      <main className="paper-grain min-h-screen flex items-center justify-center px-8 py-16">
        <div className="relative z-10 max-w-sm w-full text-center fade-in">
          <p className="font-display italic text-ink-faded text-sm mb-2">
            {weekday}
          </p>
          <p className="font-mono text-ink-faded text-xs tracking-widest mb-8">
            {dayMonth.toUpperCase()}
          </p>
          <h1 className="font-display text-5xl text-ink mb-8 leading-none">
            <span className="italic">rest</span>
          </h1>
          <p className="font-display italic text-lg text-ink-soft leading-relaxed mb-12">
            Recovery is the training.
            <br />
            Walk if you want to.
            <br />
            Sleep early.
            <br />
            Drink water.
          </p>
          <ConsistencyStrip />
        </div>
      </main>
    );
  }

  const sessionLabel = session.type === "strength" ? "strength" : "concept 2";

  return (
    <main className="paper-grain min-h-screen px-6 pt-12 pb-32">
      <div className="relative z-10 max-w-sm mx-auto">
        {/* Header */}
        <header className="mb-12 fade-in">
          <p className="font-display italic text-ink-faded text-sm">
            {weekday}
          </p>
          <p className="font-mono text-ink-faded text-[0.7rem] tracking-[0.25em] mt-1">
            {dayMonth.toUpperCase()}
          </p>
          <h1 className="font-display text-5xl text-ink mt-6 leading-[0.95]">
            <span className="italic">{sessionLabel}</span>
          </h1>
        </header>

        {/* Pre-check */}
        <section
          className="mb-14 fade-in"
          style={{ animationDelay: "120ms" }}
        >
          <p className="font-display italic text-ink-faded text-sm mb-2">
            before we begin
          </p>
          <PreCheck value={session.preWord} onSave={updatePreWord} />
        </section>

        {/* Exercises */}
        <section className="space-y-12">
          {session.plan.map((ex, i) => (
            <div
              key={ex.name}
              className="fade-in"
              style={{ animationDelay: `${200 + i * 80}ms` }}
            >
              <ExerciseBlock
                index={i + 1}
                exercise={ex}
                log={session.actuals?.[ex.name]}
                onUpdateSet={(idx, field, v) =>
                  updateSet(ex.name, idx, field, v)
                }
                onToggleBW={(idx) => toggleBodyweightSet(ex.name, idx)}
                onAddSet={() => addSet(ex.name)}
                onUpdateNotes={(n) => updateNotes(ex.name, n)}
              />
            </div>
          ))}
        </section>

        {/* Post / completed */}
        {!session.completed && (
          <section
            className="mt-16 pt-10 border-t border-line fade-in"
            style={{
              animationDelay: `${280 + session.plan.length * 80}ms`,
            }}
          >
            <PostCheck onFinish={finishSession} />
          </section>
        )}

        {session.completed && (
          <section className="mt-16 pt-10 border-t border-line text-center fade-in">
            <p className="font-display italic text-2xl text-ink leading-snug">
              You came back today.
            </p>
            {session.preWord && session.postWord && (
              <p className="font-mono text-xs text-ink-faded mt-4 tracking-wider">
                {session.preWord.toUpperCase()}
                <span className="mx-2 opacity-60">→</span>
                {session.postWord.toUpperCase()}
              </p>
            )}
            <div className="mt-10">
              <ConsistencyStrip />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ---------- Pre / Post ---------- */

function PreCheck({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => void;
}) {
  const [word, setWord] = useState(value ?? "");
  return (
    <input
      type="text"
      value={word}
      onChange={(e) => setWord(e.target.value)}
      onBlur={() => onSave(word)}
      placeholder="today I feel…"
      className="input-journal"
    />
  );
}

function PostCheck({ onFinish }: { onFinish: (v: string) => void }) {
  const [word, setWord] = useState("");
  return (
    <div className="space-y-8">
      <div>
        <p className="font-display italic text-ink-faded text-sm mb-2">
          and now?
        </p>
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="how do you feel now…"
          className="input-journal"
        />
      </div>
      <button
        onClick={() => onFinish(word)}
        className="w-full py-4 border border-ink text-ink font-display italic text-xl tracking-wide active:bg-ink active:text-paper transition-colors"
      >
        i&apos;m done
      </button>
    </div>
  );
}

/* ---------- Exercise block ---------- */

function ExerciseBlock({
  index,
  exercise,
  log,
  onUpdateSet,
  onToggleBW,
  onAddSet,
  onUpdateNotes,
}: {
  index: number;
  exercise: Exercise;
  log?: { sets: SetLog[]; notes?: string };
  onUpdateSet: (i: number, field: "weight" | "reps", v: number | null) => void;
  onToggleBW: (i: number) => void;
  onAddSet: () => void;
  onUpdateNotes: (n: string) => void;
}) {
  const last = getLastForExercise(exercise.name);
  const sets = log?.sets ?? [];
  const displayCount = Math.max(exercise.sets, sets.length);
  const isBW = exercise.bodyweight === true;
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(Boolean(log?.notes));

  return (
    <article>
      {/* Header row */}
      <header className="flex items-baseline gap-4 mb-1">
        <span className="font-mono text-xs text-ink-faded tracking-wider tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="font-display text-2xl text-ink leading-tight flex-1">
          {exercise.name.toLowerCase()}
        </h2>
        <span className="font-mono text-xs text-ink-faded tabular-nums whitespace-nowrap">
          {exercise.sets} × {exercise.reps}
        </span>
      </header>

      <p className="font-display italic text-sm text-ink-faded ml-8 mb-4">
        {exercise.load}
      </p>

      {last && !isBW && (
        <p className="font-mono text-[0.7rem] text-ink-faded ml-8 mb-5 tracking-wider">
          last ·{" "}
          {last
            .map((s) => `${s.weight ?? "—"}kg × ${s.reps ?? "—"}`)
            .join("  ·  ")}
        </p>
      )}

      {/* Set rows */}
      <div className="ml-8 space-y-3">
        {Array.from({ length: displayCount }, (_, i) => {
          const s = sets[i];
          if (isBW) {
            const done = s?.reps !== null && s?.reps !== undefined;
            return (
              <button
                key={i}
                onClick={() => onToggleBW(i)}
                className={`w-full flex items-center justify-between py-2 border-b transition-colors ${
                  done
                    ? "border-moss text-moss"
                    : "border-line-soft text-ink-faded"
                }`}
              >
                <span className="font-mono text-xs tracking-wider">
                  set {i + 1}
                </span>
                <span className="font-mono text-xs">
                  {done ? "complete" : "—"}
                </span>
              </button>
            );
          }
          return (
            <div
              key={i}
              className="grid grid-cols-[1.75rem_1fr_0.75rem_1fr] items-center gap-2 py-1"
            >
              <span className="font-mono text-[0.7rem] text-ink-faded tracking-wider">
                {String(i + 1).padStart(2, "0")}
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="kg"
                value={s?.weight ?? ""}
                onChange={(e) =>
                  onUpdateSet(
                    i,
                    "weight",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="input-numeric"
              />
              <span className="text-ink-faded text-center font-display italic text-sm">
                ×
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="reps"
                value={s?.reps ?? ""}
                onChange={(e) =>
                  onUpdateSet(
                    i,
                    "reps",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="input-numeric"
              />
            </div>
          );
        })}
      </div>

      {/* Add set */}
      <button
        onClick={onAddSet}
        className="ml-8 mt-4 font-display italic text-sm text-ink-faded hover:text-ink active:text-ink transition-colors"
      >
        + add set
      </button>

      {/* Notes */}
      <div className="ml-8 mt-4">
        {notesOpen ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onUpdateNotes(notes)}
            placeholder="a note…"
            rows={2}
            autoFocus={!log?.notes}
            className="w-full bg-transparent border-b border-line-soft outline-none font-display italic text-sm text-ink py-2 resize-none focus:border-ink-soft transition-colors"
          />
        ) : (
          <button
            onClick={() => setNotesOpen(true)}
            className="font-display italic text-sm text-ink-faded hover:text-ink transition-colors"
          >
            + a note
          </button>
        )}
      </div>
    </article>
  );
}

/* ---------- Consistency strip ---------- */

function ConsistencyStrip() {
  const days = getLastSevenDays();
  const todayISO = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex justify-center items-center gap-3">
      {days.map((d) => {
        const isToday = d.date === todayISO;
        const completed = d.completed;
        return (
          <div
            key={d.date}
            title={d.date}
            className={`relative w-2 h-2 rounded-full transition-colors ${
              completed
                ? "bg-ink"
                : isToday
                ? "bg-transparent border border-moss"
                : "bg-transparent border border-line"
            }`}
          >
            {isToday && completed && (
              <span className="absolute inset-[-4px] rounded-full border border-moss" />
            )}
          </div>
        );
      })}
    </div>
  );
}
