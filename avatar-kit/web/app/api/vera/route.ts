import { NextResponse } from 'next/server';
import { getStore, snapshot, PRESETS, simulationEnabled } from '@/lib/vera/server.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COOKIE = 'vera_sid';
type Body = { action?: string; text?: string; spoken?: string; preset?: string };

function cookieOf(req: Request): string | undefined {
  return /(?:^|;\s*)vera_sid=([0-9a-f-]{36})/.exec(req.headers.get('cookie') ?? '')?.[1];
}
/** Resolve THIS caller's session; set the cookie when a new one was created. */
function session(req: Request) {
  const s = getStore().resolve(cookieOf(req));
  const done = (res: NextResponse) => {
    if (s.created) res.cookies.set(COOKIE, s.id, { httpOnly: true, sameSite: 'strict', path: '/api/vera', secure: process.env.NODE_ENV === 'production' });
    return res;
  };
  return { ...s, done };
}

export async function GET(req: Request) {
  const s = session(req);
  return s.done(NextResponse.json({ ok: true, state: await snapshot(s.vera) }));
}

export async function POST(req: Request) {
  // CSRF: a browser always sends Origin on cross-site POSTs; refuse any that is not this host.
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return NextResponse.json({ ok: false, error: 'bad_origin' }, { status: 403 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const s = session(req);
  const v = s.vera;
  try {
    switch (body.action) {
      case 'say': {
        const text = String(body.text ?? '').trim().slice(0, 2000);
        if (!text) return s.done(NextResponse.json({ ok: false, error: 'empty' }, { status: 400 }));
        const reply = await v.brain.respond(text, { signal: req.signal });
        return s.done(NextResponse.json({ ok: true, reply, state: await snapshot(v) }));
      }
      case 'briefing': {
        const reply = await v.brain.respond('Give me the morning briefing');
        const b = v.executive.lastBriefing();
        return s.done(NextResponse.json({ ok: true, reply, briefing: b && { items: b.items, also: b.also, traces: b.traces }, state: await snapshot(v) }));
      }
      case 'event': {
        // simulation only, server-defined presets only: a client can never submit its own event
        if (!simulationEnabled()) return s.done(NextResponse.json({ ok: false, error: 'simulation_disabled' }, { status: 403 }));
        const make = body.preset ? PRESETS[body.preset as keyof typeof PRESETS] : undefined;
        if (!make) return s.done(NextResponse.json({ ok: false, error: 'unknown_preset' }, { status: 400 }));
        const r = await v.executive.ingest(make(v.now()));
        const n = r.notification;
        const announcement = n && n.decision === 'SURFACE_NOW' ? v.brain.announce(n) : null;
        return s.done(NextResponse.json({ ok: true, status: r.status, trace: r.trace, notification: n, announcement: announcement && { text: announcement.text, pending: announcement.pending }, state: await snapshot(v) }));
      }
      case 'interrupted':
        // the brain accepts only a prefix of what it actually said
        v.brain.noteInterrupted(String(body.spoken ?? '').slice(0, 4000));
        return s.done(NextResponse.json({ ok: true }));
      case 'reset': {
        // resets THIS session only
        const fresh = getStore().reset(s.id);
        return s.done(NextResponse.json({ ok: true, state: fresh ? await snapshot(fresh) : null }));
      }
      default:
        return s.done(NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 }));
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
