'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// ?review=executive — a deliberately plain console for judging the assistant, not the visuals:
// intelligence, context, memory, anticipation, tool use, conversation. No avatar, no styling effort.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createConversation } from '@/lib/vera/conversation.mjs';
import { createRemoteBrain, remoteAlert } from '@/lib/vera/remote.mjs';
import { BrowserSpeechInput, FakeSpeechInput } from '@/lib/vera/speech-input.mjs';
import { TextVoice } from '@/lib/vera/voice.mjs';

type Line = { role: string; text: string; proactive?: boolean; toolCalls?: { name: string; status: string }[] };

export function ExecutiveReview() {
  const [state, setState] = useState<any>(null);
  const [conv, setConv] = useState('READY');
  const [lines, setLines] = useState<Line[]>([]);
  const [partial, setPartial] = useState('');
  const [trace, setTrace] = useState<{ title: string; steps: { stage: string; detail: string }[] } | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const parts = useRef<any>(null);
  const brain = useRef<any>(null);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/vera', { cache: 'no-store' }).then(x => x.json());
    setState(r.state);
  }, []);

  if (!parts.current && typeof window !== 'undefined') {
    const fake = new URLSearchParams(window.location.search).has('fakemic');
    const input: any = fake ? new FakeSpeechInput() : new BrowserSpeechInput();
    const b = createRemoteBrain();
    brain.current = b;
    const convo: any = createConversation({ brain: b, voice: new TextVoice(), input, minThinkMs: 150 });
    parts.current = { convo, input, fake };
  }

  useEffect(() => {
    const p = parts.current;
    if (!p) return;
    const { convo, input, fake } = p;
    void refresh();
    const offs = [
      convo.on('state', (s: { state: string }) => setConv(s.state)),
      convo.on('line', (l: Line) => setLines(ls => [...ls, l])),
      convo.on('partial', (d: { text: string }) => setPartial(d.text)),
      convo.on('final', () => setPartial('')),
      convo.on('spoken', () => void refresh()),
      convo.on('reply', () => void refresh()),
      convo.on('interrupted', (d: { was: string; spoken: string }) => setNote(`interrupted while ${d.was}; spoken so far: "${d.spoken}"`)),
      convo.on('recovered', () => setNote('recovered to READY (no follow-up speech)')),
      convo.on('cancelled', () => setNote('turn cancelled')),
      convo.on('input_error', (e: { code: string }) => setNote(`microphone: ${e.code}`)),
      convo.on('error', (e: { stage: string; error: Error }) => setNote(`error in ${e.stage}: ${e.error?.message}`)),
    ];
    if (fake) (window as any).__vera = { convo, input, alert: (a: { text: string }) => convo.alert(remoteAlert(a)) };
    return () => offs.forEach((f: () => void) => f());
  }, [refresh]);

  const convo = () => parts.current?.convo;
  const say = (t: string) => {
    setNote(null);
    void convo()?.submit(t);
  };
  const inject = async (preset: string) => {
    setNote(null);
    const r = await brain.current.post({ action: 'event', preset });
    setState(r.state);
    setTrace({ title: `${preset} → ${r.status}${r.notification ? ` → ${r.notification.classification} / ${r.notification.decision}` : ''}`, steps: r.trace });
    if (r.announcement) convo()?.alert(remoteAlert(r.announcement, r.notification.id));
  };
  const reset = async () => {
    const r = await brain.current.post({ action: 'reset' });
    setState(r.state);
    setLines([]);
    setTrace(null);
    setNote(null);
  };
  const mic = async () => {
    const p = parts.current;
    if (p.input.listening) return p.input.stop();
    convo()?.listen();
    await p.input.start();
  };

  const c = state?.cognitive ?? {};
  const pend = state?.pending;
  const awaiting = pend?.gate?.[0];

  return (
    <main className="rv" data-review="executive">
      <header>
        <b>VERA · executive review</b>
        <span data-testid="rv-conv" className="rv-tag">{conv}</span>
        <span data-testid="rv-model" className="rv-tag">
          model: {state ? `${state.model.id}${state.model.live ? ' (live)' : ' (deterministic stand-in, not an LLM)'}` : '…'}
        </span>
        <span className="rv-tag">providers: simulated</span>
      </header>

      <section className="rv-col">
        <h2>Conversation</h2>
        <ol data-testid="rv-lines" className="rv-lines">
          {lines.map((l, i) => (
            <li key={i} className={l.role}>
              <span className="who">{l.proactive ? 'vera (proactive)' : l.role}</span> {l.text}
              {l.toolCalls?.length ? <em> [{l.toolCalls.map(t => `${t.name}:${t.status}`).join(', ')}]</em> : null}
            </li>
          ))}
          {partial ? <li className="you partial">… {partial}</li> : null}
        </ol>
        {note ? <p className="rv-note" data-testid="rv-note">{note}</p> : null}
        {awaiting ? (
          <p className="rv-confirm" data-testid="rv-confirm">
            Awaiting your confirmation: <b>{awaiting.summary}</b>{' '}
            <button type="button" onClick={() => say('yes')}>Confirm</button> <button type="button" onClick={() => say('no')}>Decline</button>
          </p>
        ) : null}
        <form
          onSubmit={e => {
            e.preventDefault();
            if (text.trim()) say(text);
            setText('');
          }}
        >
          <input aria-label="Message" id="rv-input" value={text} onChange={e => setText(e.target.value)} placeholder="Ask, tell, or command…" />
          <button type="submit">Send</button>
          <button type="button" onClick={mic}>Mic</button>
        </form>
        <div className="rv-actions">
          <button type="button" data-testid="rv-brief" onClick={() => say('Give me the morning briefing')}>Morning briefing</button>
          <button type="button" data-testid="rv-inject-carlos" onClick={() => inject('carlos_email')}>Inject: Carlos “pricing decision is urgent”</button>
          <button type="button" onClick={() => inject('competitor_news')}>Inject: competitor news</button>
          <button type="button" onClick={() => inject('newsletter')}>Inject: newsletter</button>
          <button type="button" onClick={() => inject('stranger_urgent')}>Inject: urgent stranger</button>
          <button type="button" onClick={() => convo()?.interrupt()}>Interrupt</button>
          <button type="button" onClick={reset}>Reset</button>
        </div>
      </section>

      <section className="rv-col">
        <h2>Executive cognitive state</h2>
        <dl data-testid="rv-cognitive">
          {['EXECUTIVE_CONTEXT', 'EXECUTIVE_INTENT', 'EXECUTIVE_PRIORITY', 'EXECUTIVE_MEMORY', 'EXECUTIVE_ACTION'].map(k => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{c[k] ? JSON.stringify(c[k]) : '—'}</dd>
            </div>
          ))}
        </dl>
        <h2>Pending</h2>
        <p data-testid="rv-pending">offer: {pend?.offer ? pend.offer.label : '—'} · confirmation: {awaiting ? awaiting.summary : '—'}</p>

        <h2>Pipeline trace {trace ? `· ${trace.title}` : ''}</h2>
        <ol data-testid="rv-trace" className="rv-trace">
          {(trace?.steps ?? []).map((s, i) => (
            <li key={i}>
              <b>{s.stage}</b> {s.detail}
            </li>
          ))}
        </ol>

        {state?.briefing ? (
          <>
            <h2>
              Last briefing · {state.briefing.signals} signals → {state.briefing.items.length} items
            </h2>
            <ul data-testid="rv-signals" className="rv-small">
              {state.briefing.signalRows.map((s: any, i: number) => (
                <li key={i}>
                  {s.kind}: {s.title} → {s.classification ?? 'suppressed'} / {s.decision ?? '—'} ({s.importance ?? '—'})
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h2>Tool calls</h2>
        <ul data-testid="rv-tools" className="rv-small">
          {(state?.toolCalls ?? []).map((t: any, i: number) => (
            <li key={i}>
              {t.name} {JSON.stringify(t.args)} → {t.status}
            </li>
          ))}
        </ul>
        <h2>Outbox (sent)</h2>
        <ul data-testid="rv-outbox" className="rv-small">
          {(state?.outbox ?? []).length ? state.outbox.map((o: any, i: number) => <li key={i}>{o.to}: {o.subject}</li>) : <li>nothing sent</li>}
        </ul>
        <h2>Memory</h2>
        <p className="rv-small" data-testid="rv-memory">
          {state ? Object.entries(state.memory).map(([k, v]) => `${k} ${v}`).join(' · ') : '…'}
        </p>
        <p className="rv-small">facts: {(state?.memoryItems?.facts ?? []).join(' | ') || '—'}</p>
        <h2>Skills</h2>
        <p className="rv-small" data-testid="rv-skills">
          {(state?.skills ?? []).map((s: any) => `${s.title} (${s.status})`).join(' · ')}
        </p>
      </section>
    </main>
  );
}
