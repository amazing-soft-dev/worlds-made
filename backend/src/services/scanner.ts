import { LIMITS } from '@worlds-made/shared';

export interface ScanResult {
  ok: boolean;
  /** Reasons the file must be rejected. */
  problems: string[];
  /** Things that make a game worse but do not make it unsafe. */
  warnings: string[];
  bytes: number;
}

interface Rule {
  re: RegExp;
  message: string;
}

/**
 * Generated games are untrusted code. This scan runs before a game is stored, published or downloaded, and it is
 * deliberately conservative: a false positive costs one regeneration, a false negative costs a sandbox escape attempt.
 * The sandbox, CSP and separate origin are the real defence; this is the first of several layers.
 */
const RULES: Rule[] = [
  // External resources
  { re: /\bhttps?:\/\/(?!www\.w3\.org\/)/i, message: 'external URL' },
  { re: /\b(?:src|href|action|data|poster|srcset)\s*=\s*["']?\s*\/\//i, message: 'protocol-relative URL' },
  { re: /url\(\s*["']?\s*(?:https?:|\/|\.\.?\/)/i, message: 'external CSS url()' },
  { re: /@import\b/i, message: 'CSS @import' },
  { re: /<script\b[^>]*\bsrc\s*=/i, message: 'external script' },
  { re: /<link\b/i, message: '<link> element' },
  { re: /<(?:iframe|frame|object|embed|form|base)\b/i, message: 'frame, object, form or base element' },
  { re: /<meta\b[^>]*http-equiv/i, message: 'meta http-equiv' },

  // Network and background execution
  { re: /\bfetch\s*\(/, message: 'fetch()' },
  { re: /\bXMLHttpRequest\b/, message: 'XMLHttpRequest' },
  { re: /\bWebSocket\b|\bEventSource\b|\bRTCPeerConnection\b/, message: 'WebSocket, EventSource or WebRTC' },
  { re: /\bsendBeacon\b/, message: 'sendBeacon' },
  { re: /\bimportScripts\b|\bnew\s+(?:Shared)?Worker\b|\bserviceWorker\b/, message: 'workers' },
  { re: /\bimport\s*\(/, message: 'dynamic import()' },

  // Running code from strings
  { re: /\beval\s*\(/, message: 'eval()' },
  { re: /\bnew\s+Function\b|(?<![\w.])Function\s*\(/, message: 'Function constructor' },
  { re: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/, message: 'timer with a string of code' },

  // Storage and identity
  { re: /\bdocument\s*\.\s*cookie\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bcaches\s*\./, message: 'cookie or storage API' },
  { re: /\bdocument\s*\.\s*domain\b/, message: 'document.domain' },

  // Leaving the frame
  { re: /\bwindow\s*\.\s*open\b/, message: 'window.open' },
  { re: /\btop\s*\./, message: 'access to top window' },
  { re: /\bparent\s*\.\s*(?:location|document|frames)\b/, message: 'access to parent location or document' },
  { re: /\b(?:window\s*\.\s*)?location\s*(?:=(?!=)|\.\s*(?:href|assign|replace))/, message: 'navigation' },

  // Computed access to banned globals, the usual way to hide the calls above
  { re: /\b(?:window|self|globalThis|top|parent)\s*\[/, message: 'computed global access' },
  { re: /\[\s*["'`](?:fetch|XMLHttpRequest|WebSocket|eval|Function|localStorage|sessionStorage|cookie|location)["'`]\s*\]/, message: 'computed access to a banned API' },
];

export function scanGameHtml(html: string): ScanResult {
  const bytes = Buffer.byteLength(html, 'utf8');
  const problems: string[] = [];
  const warnings: string[] = [];

  if (bytes > LIMITS.maxGameBytes) problems.push(`file is ${bytes} bytes, over the ${LIMITS.maxGameBytes} byte limit`);
  if (!/<(?:html|body|canvas)\b/i.test(html)) problems.push('not an HTML game (no <html>, <body> or <canvas>)');
  for (const rule of RULES) if (rule.re.test(html)) problems.push(rule.message);

  if (!/\bpostMessage\s*\(/.test(html)) warnings.push('never reports a score with parent.postMessage');
  if (!/keydown|keyup/i.test(html)) warnings.push('no keyboard controls');
  if (!/touchstart|pointerdown|click/i.test(html)) warnings.push('no touch or pointer controls');

  return { ok: problems.length === 0, problems: [...new Set(problems)], warnings, bytes };
}

/** Visible strings for moderation: page text, attributes, and human-looking string literals in the script. */
export function extractVisibleText(html: string): string[] {
  const found = new Set<string>();
  const add = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    if (t.length >= 2) found.add(t);
  };
  for (const m of html.matchAll(/<(?:title|h[1-6]|p|button|label|li|span|div|a)\b[^>]*>([^<]{2,300})</gi)) add(m[1] ?? '');
  for (const m of html.matchAll(/\b(?:alt|placeholder|aria-label|title)\s*=\s*"([^"]{2,200})"/gi)) add(m[1] ?? '');
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const m of (script[1] ?? '').matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n]){4,160})\1/g)) {
      const s = m[2] ?? '';
      if (/[A-Za-z]{3,}/.test(s) && /\s/.test(s)) add(s);
    }
  }
  return [...found].slice(0, 300);
}
