// Composition root: wires memory, providers, tools, skills, proactive engine, model and brain.
import { createConfirmationGate, createToolRegistry } from './tools.mjs';
import { createExecutive } from './executive.mjs';
import { registerSkills } from './skills.mjs';
import { createBrain } from './brain.mjs';
import { createModel } from './models.mjs';
import { assertProvider } from './providers.mjs';
import { seedMemory, seedProviders, NOW } from './scenario.mjs';

export function createVera({ memory, providers, model, now, env = {}, fetchImpl } = {}) {
  const clock = now ?? (() => NOW);
  memory ??= seedMemory(clock);
  const raw = providers ?? seedProviders();
  const calendar = assertProvider('calendar', raw.calendar);
  const email = assertProvider('email', raw.email);
  const news = assertProvider('news', raw.news);
  const gate = createConfirmationGate({ now: clock });
  const registry = createToolRegistry({ gate });
  const executive = createExecutive({ memory, calendar, email, news, now: clock });
  const { skills } = registerSkills({ registry, memory, calendar, email, news, executive, now: clock });
  model ??= createModel({ env, fetchImpl });
  const brain = createBrain({ memory, registry, gate, executive, model, skills, now: clock });
  return { memory, calendar, email, news, gate, registry, executive, skills, model, brain, now: clock };
}
