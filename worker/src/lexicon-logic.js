import { canon } from "./translate.js";

export const ENTRY_CAP = 400;
const KINDS = new Set(["word", "jargon", "expression"]);
const LIMIT = { word: 48, jargon: 80, expression: 180 };

function fail(message) {
  const err = new Error(message);
  err.status = 400;
  throw err;
}

export function phrase(value, kind) {
  const clean = String(value || "").replace(/[\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ");
  if ([...clean].length < 2) fail("phrase too short");
  const limit = LIMIT[kind] || 180;
  if ([...clean].length > limit) fail("phrase too long");
  return clean;
}

function keyOf(text) {
  return text.trim().toLowerCase().replace(/[!.?]+$/g, "").replace(/\s+/g, " ");
}

export function normalizeEntry(body) {
  const kind = KINDS.has(body?.kind) ? body.kind : "expression";
  const pivot = phrase(body?.pivot, kind);
  const text = { en: pivot };
  const lines = body?.lines && typeof body.lines === "object" ? body.lines : {};
  let count = 0;
  for (const [lang, value] of Object.entries(lines)) {
    if (count >= 24) break;
    if (!String(value || "").trim()) continue;
    text[canon(lang)] = phrase(value, kind);
    count += 1;
  }
  text.en = pivot;
  return { kind, text };
}

/** One phrase stays one entry. A later correction fills more languages on it. */
export function upsert(entries, body, now = Date.now()) {
  const next = normalizeEntry(body);
  const keys = new Set(Object.values(next.text).map(keyOf));
  let found = null;
  if (body?.id) found = entries.find((entry) => entry.id === body.id) || null;
  if (!found) {
    found = entries.find((entry) => Object.values(entry.text || {}).some((line) => keys.has(keyOf(line)))) || null;
  }
  const saved = {
    id: found?.id || (body?.id ? String(body.id) : crypto.randomUUID()),
    kind: next.kind,
    text: found ? { ...found.text, ...next.text, en: next.text.en } : next.text,
    createdAt: found?.createdAt || now
  };
  const merged = [saved, ...entries.filter((entry) => entry.id !== saved.id)].slice(0, ENTRY_CAP);
  return { entries: merged, saved };
}
