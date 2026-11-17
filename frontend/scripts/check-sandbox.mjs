// Guards the sandbox: the only iframe in the app is the game player, and its sandbox is exactly "allow-scripts".
// Adding allow-same-origin, allow-forms, allow-popups, allow-top-navigation or allow-modals would let untrusted
// generated code reach the site, so this fails CI if anyone does.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const FORBIDDEN = ['allow-same-origin', 'allow-forms', 'allow-popups', 'allow-top-navigation', 'allow-modals', 'allow-downloads', 'allow-presentation', 'allow-pointer-lock', 'allow-orientation-lock'];
const problems = [];
let iframes = 0;

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx|jsx|ts|js)$/.test(name)) {
      const code = stripComments(readFileSync(full, 'utf8'));
      const rel = relative(root, full).replaceAll('\\', '/');
      const found = code.match(/<iframe\b/g)?.length ?? 0;
      iframes += found;
      if (found && !rel.endsWith('components/game/SandboxPlayer.tsx')) problems.push(`${rel}: an <iframe> outside SandboxPlayer`);
      for (const m of code.matchAll(/\bsandbox\s*=\s*(?:"([^"]*)"|\{\s*["'`]([^"'`]*)["'`]\s*\})/g)) {
        const value = (m[1] ?? m[2] ?? '').trim();
        if (value !== 'allow-scripts') problems.push(`${rel}: sandbox="${value}" must be exactly "allow-scripts"`);
      }
      for (const word of FORBIDDEN) if (code.includes(word)) problems.push(`${rel}: mentions ${word}`);
    }
  }
}
walk(root);

if (iframes === 0) problems.push('no <iframe> found: the player is missing');
if (problems.length) {
  console.error('check:sandbox failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log(`check:sandbox ok: ${iframes} iframe, sandbox="allow-scripts" only.`);
