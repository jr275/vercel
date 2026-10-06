// Copies the drop-in avatar package (../embed) into this app: static files to public/avatar-kit, the React files to components/avatar.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const embed = join(here, '..', '..', 'embed');
const pub = join(here, '..', 'public', 'avatar-kit');
const comp = join(here, '..', 'components', 'avatar');
mkdirSync(pub, { recursive: true });
mkdirSync(comp, { recursive: true });
for (const f of readdirSync(embed)) {
  if (f.endsWith('.tsx') || f.endsWith('.ts')) cpSync(join(embed, f), join(comp, f));
  else if (f === 'avatar-kit.js' || f === 'vendor') cpSync(join(embed, f), join(pub, f), { recursive: true });
}
console.log('avatar package synced');
