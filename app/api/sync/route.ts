import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const expected = process.env.SYNC_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token === expected;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await ensureSchema();
    const p = getPool();
    const { rows } = await p.query(
      "SELECT user_data, sessions, updated_at FROM selfcare_state WHERE id = 'me' LIMIT 1",
    );
    const row = rows[0] ?? { user_data: {}, sessions: [], updated_at: null };
    return NextResponse.json({
      user: row.user_data && Object.keys(row.user_data).length ? row.user_data : null,
      sessions: row.sessions ?? [],
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error("sync GET error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await ensureSchema();
    const body = await req.json();
    const user = body.user ?? null;
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    const p = getPool();
    await p.query(
      `INSERT INTO selfcare_state (id, user_data, sessions, updated_at)
       VALUES ('me', $1::jsonb, $2::jsonb, now())
       ON CONFLICT (id) DO UPDATE
         SET user_data = EXCLUDED.user_data,
             sessions = EXCLUDED.sessions,
             updated_at = now()`,
      [JSON.stringify(user ?? {}), JSON.stringify(sessions)],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("sync POST error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
