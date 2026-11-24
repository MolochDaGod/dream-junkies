import { DurableObject } from "cloudflare:workers";
import { upsert } from "./lexicon-logic.js";

export class Lexicon extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        pivot TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS lines (
        entry_id TEXT NOT NULL,
        lang TEXT NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (entry_id, lang)
      )`);
    });
  }

  all() {
    const rows = this.ctx.storage.sql.exec(
      "SELECT id, kind, pivot, created_at FROM entries ORDER BY created_at DESC"
    ).toArray();
    const lines = this.ctx.storage.sql.exec(
      "SELECT entry_id, lang, text FROM lines"
    ).toArray();
    const byId = new Map();
    for (const row of rows) {
      byId.set(row.id, {
        id: row.id,
        kind: row.kind,
        text: { en: row.pivot },
        createdAt: row.created_at
      });
    }
    for (const line of lines) {
      const entry = byId.get(line.entry_id);
      if (entry) entry.text[line.lang] = line.text;
    }
    return [...byId.values()];
  }

  save(body) {
    const current = this.all();
    const { entries, saved } = upsert(current, body || {});
    const keep = new Set(entries.map((entry) => entry.id));
    for (const entry of current) {
      if (keep.has(entry.id)) continue;
      this.ctx.storage.sql.exec("DELETE FROM lines WHERE entry_id = ?", entry.id);
      this.ctx.storage.sql.exec("DELETE FROM entries WHERE id = ?", entry.id);
    }
    this.ctx.storage.sql.exec("DELETE FROM lines WHERE entry_id = ?", saved.id);
    this.ctx.storage.sql.exec("DELETE FROM entries WHERE id = ?", saved.id);
    this.ctx.storage.sql.exec(
      "INSERT INTO entries (id, kind, pivot, created_at) VALUES (?, ?, ?, ?)",
      saved.id,
      saved.kind,
      saved.text.en,
      saved.createdAt
    );
    for (const [lang, text] of Object.entries(saved.text)) {
      this.ctx.storage.sql.exec(
        "INSERT INTO lines (entry_id, lang, text) VALUES (?, ?, ?)",
        saved.id,
        lang,
        text
      );
    }
    return saved;
  }

  remove(id) {
    const key = String(id || "");
    this.ctx.storage.sql.exec("DELETE FROM lines WHERE entry_id = ?", key);
    this.ctx.storage.sql.exec("DELETE FROM entries WHERE id = ?", key);
    return { ok: true };
  }
}

export async function loadEntries(env) {
  if (!env?.LEXICON) return [];
  try {
    const rows = await env.LEXICON.getByName("global").all();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
