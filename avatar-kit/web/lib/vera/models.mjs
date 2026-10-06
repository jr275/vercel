// MODEL LAYER. Interface:
//   model.complete({ system, messages, tools, signal, meta }) -> Promise<{ text, toolCalls: [{id,name,args}] }>
// messages: { role:'user'|'assistant'|'tool', content, toolCalls?, results? }
//
// AnthropicModel is the real LLM provider (HTTP, injectable fetch). ScriptedModel is a deterministic
// *stand-in for tests and for running with no API key*: it plans tool calls from the classified intent
// and phrases the reply from the tool results. It is not an LLM and is reported as such (`model.live`).
import { list, abortError } from './util.mjs';

export class AnthropicModel {
  constructor({ apiKey, model = 'claude-sonnet-5-5', fetchImpl = globalThis.fetch, baseUrl = 'https://api.anthropic.com', maxTokens = 700 } = {}) {
    Object.assign(this, { apiKey, model, fetchImpl, baseUrl, maxTokens, id: `anthropic:${model}`, live: true });
  }
  available() {
    return !!this.apiKey && typeof this.fetchImpl === 'function';
  }
  static toApiMessages(messages) {
    const out = [];
    for (const m of messages) {
      if (m.role === 'user') out.push({ role: 'user', content: m.content });
      else if (m.role === 'assistant') {
        const blocks = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const c of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args ?? {} });
        out.push({ role: 'assistant', content: blocks });
      } else if (m.role === 'tool') {
        out.push({ role: 'user', content: (m.results ?? []).map(r => ({ type: 'tool_result', tool_use_id: r.id, content: JSON.stringify(r.output) })) });
      }
    }
    // The Messages API requires the first message to be from the user. A proactive alert can open the history
    // with an assistant turn, so give it a user turn to answer.
    if (out[0]?.role === 'assistant') out.unshift({ role: 'user', content: '(session started)' });
    return out;
  }
  async complete({ system, messages, tools = [], signal }) {
    if (signal?.aborted) throw abortError();
    const res = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages: AnthropicModel.toApiMessages(messages),
        tools: tools.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text?.().catch(() => '')) ?? ''}`.slice(0, 300));
    const j = await res.json();
    const blocks = j.content ?? [];
    return {
      text: blocks.filter(b => b.type === 'text').map(b => b.text).join('').trim(),
      toolCalls: blocks.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, args: b.input ?? {} })),
      usage: j.usage ?? null,
    };
  }
}

// ---- ScriptedModel -----------------------------------------------------------------------------------
const PLAN = {
  briefing: () => [['morning_briefing', {}]],
  calendar: () => [['calendar_analysis', { days: 2 }]],
  email: () => [['email_inbox', {}]],
  meeting_prep: m => [['meeting_prep', { person: m.entities.people[0], meeting: m.text.match(/\b(investor update|project x sync)\b/i)?.[0], topic: m.text.match(/pricing/i)?.[0] }]],
  recall: m => (m.entities.people[0] ? [['person_context', { name: m.entities.people[0] }]] : [['memory_recall', { query: m.text }]]),
  learn: m => [['memory_learn', { text: m.text }]],
  followup: m => [['followup_list', { person: m.entities.people[0] }]],
  reminder: m => [['reminder_add', { text: m.text.replace(/^\s*remind me( to)?\s*/i, ''), person: m.entities.people[0] }]],
  decision: m => [['decision_support', { topic: m.text.match(/pricing/i)?.[0] ?? m.text }]],
  news: () => [['news_feed', {}]],
  email_send: m => {
    const to = m.entities.people[0];
    const saying = m.text.match(/\b(?:saying|that|to say)\s+(.+)$/i)?.[1];
    return [['email_send', { to: to ?? 'unknown', subject: saying ? saying.slice(0, 60) : 'Follow-up', body: saying ?? '' }]];
  },
  accept_offer: m => m.offer?.calls ?? [],
};

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const COMPOSE = {
  morning_briefing: r => r.text,
  calendar_analysis: r => {
    if (!r.count) return 'Your calendar is clear for the next two days.';
    const p = [`You have ${plural(r.count, 'meeting')} coming up.`];
    if (r.important.length) p.push(`The ones that matter: ${list(r.important.map(e => `${e.title} ${e.when}${e.attendees.length ? ` with ${list(e.attendees)}` : ''}`))}.`);
    r.conflicts.forEach(c => p.push(`${c.a} overlaps with ${c.b} ${c.when}.`));
    if (r.prep.length) p.push(`${list(r.prep.map(e => e.title))} ${r.prep.length > 1 ? 'need' : 'needs'} preparation${r.prep.some(e => e.openItems.length) ? `, with ${plural(r.prep.reduce((a, e) => a + e.openItems.length, 0), 'unresolved item')} behind ${r.prep.length > 1 ? 'them' : 'it'}` : ''}.`);
    r.dates.forEach(d => p.push(`${d.person}'s ${d.kind} is ${d.inDays === 0 ? 'today' : d.inDays === 1 ? 'tomorrow' : `in ${d.inDays} days`}.`));
    return p.join(' ');
  },
  email_inbox: r => {
    const p = [`${plural(r.total, 'message')} this week, ${r.relevant.length} relevant to you.`];
    r.relevant.slice(0, 3).forEach(m => p.push(`${m.from}${m.urgent ? ', urgent' : ''}: ${m.summary}${m.connected.length ? ` This connects to ${list(m.connected.map(c => c.toLowerCase()))}.` : ''}`));
    if (r.unanswered.length) p.push(`Unanswered: ${list(r.unanswered.map(u => `${u.from} about ${u.subject.toLowerCase()}, ${u.ageDays} days old`))}.`);
    return p.join(' ');
  },
  person_context: r => {
    if (!r.found) return `I do not have anyone called ${r.name} in memory.`;
    const p = [`${r.name}${r.role ? `, ${r.role}` : ''}${r.company ? ` at ${r.company}` : ''}.`];
    if (r.projects.length) p.push(`Connected to ${list(r.projects)}.`);
    if (r.lastContactDays != null) p.push(`You last spoke ${r.lastContactDays} days ago${r.lastSummary ? `: ${r.lastSummary}` : ''}.`);
    const open = [...r.decisions, ...r.issues, ...r.commitments];
    if (open.length) p.push(`Still open: ${list(open.map(x => x.toLowerCase()))}.`);
    r.facts.forEach(f => p.push(f.endsWith('.') ? f : f + '.'));
    return p.join(' ');
  },
  memory_recall: r => (r.matches.length ? `Here is what I have: ${list(r.matches.slice(0, 4).map(m => m.text.trim()))}.` : 'I have nothing stored about that.'),
  memory_learn: r => `Noted. I will remember that ${r.text.replace(/\.$/, '')}.`,
  company_info: r => (r.found ? `${r.name} is a ${r.kind}.${r.people.length ? ` People: ${list(r.people)}.` : ''}${r.projects.length ? ` Projects: ${list(r.projects)}.` : ''}` : `I do not have that company in memory.`),
  meeting_prep: r => {
    if (!r.meeting && !r.attendees.length) return 'I could not find that meeting.';
    const p = [r.meeting ? `${r.meeting.title}, ${r.meeting.when}.` : 'No meeting found, but here is the person context.'];
    r.attendees.forEach(a => p.push(`${a.name}${a.role ? `, ${a.role}` : ''}: last spoke ${a.lastContactDays ?? 'an unknown number of'} days ago.`));
    if (r.openItems.length) p.push(`${cap(plural(r.openItems.length, 'open item'))}: ${r.openItems.join('; ')}.`);
    if (r.related.length) p.push(`Relevant news: ${list(r.related)}.`);
    if (r.missingAgenda) p.push('There is no agenda attached.');
    return p.join(' ');
  },
  followup_list: r => {
    const bits = [...r.commitments.map(c => `you owe: ${c.text.toLowerCase()}`), ...r.decisions.map(d => `undecided: ${d.toLowerCase()}`), ...r.issues.map(i => i.toLowerCase())];
    return bits.length ? `${r.person ? `With ${r.person}, ` : ''}${plural(bits.length, 'thing')} open. ${cap(list(bits))}.` : 'Nothing is open right now.';
  },
  reminder_add: r => `Reminder saved: ${r.text}.`,
  decision_support: r => {
    if (!r.decisions.length) return `I have no open decision about that.`;
    const d = r.decisions[0];
    const p = [`${d.topic} is unresolved${d.summary ? `: ${d.summary}` : ''}.`];
    if (d.people.length) p.push(`Involves ${list(d.people)}.`);
    if (r.openIssues.length) p.push(`Open points: ${list(r.openIssues.map(x => x.toLowerCase()))}.`);
    if (r.changes.length) p.push(`What changed: ${list(r.changes)}.`);
    return p.join(' ');
  },
  news_feed: r => {
    const rel = r.items.filter(i => i.relevant);
    return rel.length ? `${plural(rel.length, 'relevant item')}: ${list(rel.map(i => i.headline))}.` : 'Nothing relevant in the news.';
  },
};

export class ScriptedModel {
  constructor() {
    Object.assign(this, { id: 'scripted', live: false });
  }
  available() {
    return true;
  }
  async complete({ messages, meta = {}, signal }) {
    if (signal?.aborted) throw abortError();
    const last = messages[messages.length - 1];
    if (last.role === 'user') {
      const plan = PLAN[meta.intent]?.({ text: last.content, entities: meta.entities ?? { people: [] }, offer: meta.offer });
      if (plan?.length) return { text: '', toolCalls: plan.map(([name, args], i) => ({ id: `tc_${messages.length}_${i}`, name, args })) };
      return { text: this.smalltalk(meta), toolCalls: [] };
    }
    // tool results -> reply
    const parts = [];
    for (const r of last.results) {
      const o = r.output;
      if (o?.status === 'awaiting_confirmation') {
        parts.push(`I have prepared this: ${o.confirmation.summary}. It has not been sent. Shall I go ahead?`);
      } else if (o?.error) parts.push(`I could not do that: ${o.error}.`);
      else if (COMPOSE[r.name]) parts.push(COMPOSE[r.name](o.result ?? o));
      else if (r.name === 'email_send') parts.push(`Sent to ${o.result?.toName}.`);
    }
    return { text: parts.join(' '), toolCalls: [] };
  }
  smalltalk(meta) {
    if (meta.intent === 'greeting') return 'Good to see you. Shall I brief you, or is there something specific?';
    if (meta.intent === 'decline_offer') return 'Understood. I will leave it.';
    return `I can brief you, check your calendar and email, prepare a meeting, recall what I know about someone, or draft a message. What do you need?`;
  }
}

/** Pick the live model when a key is configured, otherwise the scripted stand-in. Never throws. */
export function createModel({ env = {}, fetchImpl } = {}) {
  const key = env.ANTHROPIC_API_KEY;
  if (key) return new AnthropicModel({ apiKey: key, model: env.VERA_MODEL || undefined, fetchImpl });
  return new ScriptedModel();
}
