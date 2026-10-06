import { NextResponse } from 'next/server';
import { getVera, resetVera, snapshot, PRESETS } from '@/lib/vera/server.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = { action?: string; text?: string; spoken?: string; preset?: string; raw?: Record<string, unknown> };

export async function GET() {
  return NextResponse.json({ ok: true, state: snapshot(getVera()) });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const v = getVera();
  try {
    switch (body.action) {
      case 'say': {
        const text = String(body.text ?? '').trim().slice(0, 2000);
        if (!text) return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 });
        const reply = await v.brain.respond(text, { signal: req.signal });
        return NextResponse.json({ ok: true, reply, state: snapshot(v) });
      }
      case 'briefing': {
        const reply = await v.brain.respond('Give me the morning briefing');
        const b = v.executive.lastBriefing();
        return NextResponse.json({ ok: true, reply, briefing: b && { items: b.items, also: b.also, traces: b.traces }, state: snapshot(v) });
      }
      case 'event': {
        const raw = body.raw ?? (body.preset && PRESETS[body.preset as keyof typeof PRESETS]?.(v.now()));
        if (!raw) return NextResponse.json({ ok: false, error: 'unknown_preset' }, { status: 400 });
        const r = await v.executive.ingest(raw);
        const n = r.notification;
        const announcement = n && n.decision === 'SURFACE_NOW' ? v.brain.announce(n) : null;
        return NextResponse.json({ ok: true, status: r.status, trace: r.trace, notification: n, announcement: announcement && { text: announcement.text, pending: announcement.pending }, state: snapshot(v) });
      }
      case 'interrupted':
        v.brain.noteInterrupted(String(body.spoken ?? ''));
        return NextResponse.json({ ok: true });
      case 'reset':
        return NextResponse.json({ ok: true, state: snapshot(resetVera()) });
      default:
        return NextResponse.json({ ok: false, error: 'unknown_action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
