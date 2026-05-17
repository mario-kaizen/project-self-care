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

const EQUIPMENT_OPTIONS = [
  "Squat rack",
  "Barbell + plates (150kg)",
  "Bench",
  "Dumbbells",
  "Bands",
  "Concept2",
];

export default function Home() {
  const [user, setUserState] = useState<User | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    setUserState(u);
    fetch("/program.json")
      .then((r) => r.json())
      .then((p: Program) => {
        setProgram(p);
        if (u) setSession(getOrCreateTodaySession(u, p));
        setReady(true);
      });
  }, []);

  if (!ready) {
    return <main className="min-h-screen" />;
  }

  if (!user || !program) {
    return (
      <Setup
        onDone={(u) => {
          persistUser(u);
          setUserState(u);
          setSession(getOrCreateTodaySession(u, program!));
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
      }}
    />
  );
}

function Setup({ onDone }: { onDone: (u: User) => void }) {
  const [equipment, setEquipment] = useState<string[]>(EQUIPMENT_OPTIONS);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-light tracking-tight">Project Self Care</h1>
          <p className="text-stone-600 text-base leading-relaxed">
            Coming home to yourself, one session at a time. Today is day one.
          </p>
        </header>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-stone-700">
            Equipment you have
          </label>
          <div className="space-y-2">
            {EQUIPMENT_OPTIONS.map((item) => (
              <label
                key={item}
                className="flex items-center gap-3 p-3 rounded-lg bg-white border border-stone-200"
              >
                <input
                  type="checkbox"
                  checked={equipment.includes(item)}
                  onChange={(e) => {
                    if (e.target.checked) setEquipment([...equipment, item]);
                    else setEquipment(equipment.filter((x) => x !== item));
                  }}
                  className="w-5 h-5 accent-stone-900"
                />
                <span className="text-stone-800">{item}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={() =>
            onDone({
              startDate: new Date().toISOString().slice(0, 10),
              equipment,
            })
          }
          className="w-full py-4 bg-stone-900 text-stone-50 rounded-xl text-base font-medium active:bg-stone-800 transition-colors"
        >
          Begin
        </button>
      </div>
    </main>
  );
}

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

  const dateLabel = new Date(session.date + "T00:00:00").toLocaleDateString(
    undefined,
    { weekday: "long", month: "short", day: "numeric" },
  );

  if (session.type === "rest") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <p className="text-sm text-stone-500">{dateLabel}</p>
          <h1 className="text-3xl font-light tracking-tight">Rest day</h1>
          <p className="text-stone-600 leading-relaxed">
            Recovery is the training. Walk if you want to. Sleep early. Drink water.
          </p>
          <ConsistencyStrip />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 pb-24">
      <div className="max-w-md mx-auto space-y-8">
        <header className="space-y-1">
          <p className="text-sm text-stone-500">{dateLabel}</p>
          <h1 className="text-2xl font-light tracking-tight">
            {session.type === "strength" ? "Strength" : "Concept2"}
          </h1>
        </header>

        <PreCheck value={session.preWord} onSave={updatePreWord} />

        <section className="space-y-6">
          {session.plan.map((ex) => (
            <ExerciseCard
              key={ex.name}
              exercise={ex}
              log={session.actuals?.[ex.name]}
              onUpdateSet={(i, field, v) => updateSet(ex.name, i, field, v)}
              onToggleBW={(i) => toggleBodyweightSet(ex.name, i)}
              onAddSet={() => addSet(ex.name)}
              onUpdateNotes={(n) => updateNotes(ex.name, n)}
            />
          ))}
        </section>

        {!session.completed && <PostCheck onFinish={finishSession} />}

        {session.completed && (
          <div className="space-y-4 pt-4">
            <p className="text-center text-lg font-light text-stone-700">
              You came back today.
            </p>
            <ConsistencyStrip />
          </div>
        )}
      </div>
    </main>
  );
}

function PreCheck({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => void;
}) {
  const [word, setWord] = useState(value ?? "");
  return (
    <section className="space-y-2">
      <label className="block text-sm text-stone-600">
        Before we start. One word for how you&apos;re feeling.
      </label>
      <input
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onBlur={() => onSave(word)}
        placeholder="…"
        className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-base focus:outline-none focus:border-stone-400"
      />
    </section>
  );
}

function PostCheck({ onFinish }: { onFinish: (v: string) => void }) {
  const [word, setWord] = useState("");
  return (
    <section className="space-y-3 pt-4 border-t border-stone-200">
      <label className="block text-sm text-stone-600">
        Done? One word for how you&apos;re feeling now.
      </label>
      <input
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="…"
        className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-base focus:outline-none focus:border-stone-400"
      />
      <button
        onClick={() => onFinish(word)}
        className="w-full py-4 bg-stone-900 text-stone-50 rounded-xl text-base font-medium active:bg-stone-800 transition-colors"
      >
        I&apos;m done
      </button>
    </section>
  );
}

function ExerciseCard({
  exercise,
  log,
  onUpdateSet,
  onToggleBW,
  onAddSet,
  onUpdateNotes,
}: {
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

  return (
    <div className="space-y-3 p-4 bg-white border border-stone-200 rounded-xl">
      <header>
        <div className="flex justify-between items-baseline">
          <h2 className="text-lg font-medium">{exercise.name}</h2>
          <span className="text-sm text-stone-500">
            {exercise.sets} × {exercise.reps}
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-1">{exercise.load}</p>
        {last && !isBW && (
          <p className="text-xs text-stone-500 mt-2">
            Last: {last.map((s) => `${s.weight ?? "—"}kg × ${s.reps ?? "—"}`).join(", ")}
          </p>
        )}
      </header>

      <div className="space-y-2">
        {Array.from({ length: displayCount }, (_, i) => {
          const s = sets[i];
          if (isBW) {
            const done = s?.reps !== null && s?.reps !== undefined;
            return (
              <button
                key={i}
                onClick={() => onToggleBW(i)}
                className={`w-full px-3 py-3 rounded-lg text-sm font-medium border transition-colors ${
                  done
                    ? "bg-stone-900 text-stone-50 border-stone-900"
                    : "bg-stone-50 text-stone-600 border-stone-200"
                }`}
              >
                Set {i + 1} {done ? "✓" : ""}
              </button>
            );
          }
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-stone-500 w-12">Set {i + 1}</span>
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
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-base focus:outline-none focus:border-stone-400"
              />
              <span className="text-stone-400">×</span>
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
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-base focus:outline-none focus:border-stone-400"
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={onAddSet}
        className="w-full py-2 text-sm text-stone-600 border border-dashed border-stone-300 rounded-lg active:bg-stone-100 transition-colors"
      >
        + add set
      </button>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => onUpdateNotes(notes)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-stone-400 resize-none"
      />
    </div>
  );
}

function ConsistencyStrip() {
  const days = getLastSevenDays();
  return (
    <div className="flex justify-center gap-2 pt-2">
      {days.map((d) => (
        <div
          key={d.date}
          title={d.date}
          className={`w-3 h-3 rounded-full ${
            d.completed ? "bg-stone-700" : "bg-stone-200"
          }`}
        />
      ))}
    </div>
  );
}
