export type User = {
  startDate: string;        // YYYY-MM-DD
  equipment: string[];
};

export type SetLog = {
  set: number;              // 1-indexed
  weight: number | null;    // kg, null for bodyweight
  reps: number | null;      // actual reps completed
};

export type ExerciseLog = {
  sets: SetLog[];
  notes?: string;
};

export type Exercise = {
  name: string;
  sets: number;
  reps: number | string;    // string handles "20 min" / "30s hold"
  load: string;             // human-readable: "30% of working weight" / "RPE 3-4"
  bodyweight?: boolean;
};

export type SessionType = "strength" | "concept2" | "rest";

export type Session = {
  id: string;
  date: string;             // YYYY-MM-DD
  type: SessionType;
  plan: Exercise[];
  actuals?: { [exerciseName: string]: ExerciseLog };
  completed: boolean;
  completedAt: string | null;
  preWord: string | null;
  postWord: string | null;
};

export type ProgramDay = {
  day: number;
  type: SessionType;
  exercises: Exercise[];
};

export type Program = {
  days: ProgramDay[];
};
