/** English is the middle ground. Players receive only `forListener`. */

export const MIDDLE = "en";

export const LANGUAGES = [
  { code: "ig", name: "Igbo", region: "Nigeria", play: true },
  { code: "en", name: "English", region: "middle", play: true },
  { code: "yo", name: "Yoruba", region: "Nigeria", play: true },
  { code: "ha", name: "Hausa", region: "Nigeria", play: true },
  { code: "fr", name: "French", play: true },
  { code: "es", name: "Spanish", play: true },
  { code: "pt", name: "Portuguese", play: true },
  { code: "zh", name: "Chinese", play: true },
  { code: "ja", name: "Japanese", play: true },
  { code: "ar", name: "Arabic", play: true },
  { code: "de", name: "German", play: true },
  { code: "hi", name: "Hindi", play: true },
  { code: "ko", name: "Korean", play: true },
  { code: "ru", name: "Russian", play: true },
  { code: "sw", name: "Swahili", play: true }
];

const ALIAS = new Map();
for (const lang of LANGUAGES) {
  ALIAS.set(lang.code, lang.code);
  ALIAS.set(lang.name.toLowerCase(), lang.code);
}
ALIAS.set("ig-ng", "ig");
ALIAS.set("igbo", "ig");
ALIAS.set("english", "en");
ALIAS.set("yoruba", "yo");
ALIAS.set("hausa", "ha");

const MODEL = "@cf/meta/m2m100-1.2b";

export function canon(input) {
  const key = String(input || "").trim().toLowerCase().replaceAll("_", "-");
  const code = ALIAS.get(key);
  if (!code) {
    const err = new Error("unsupported language");
    err.status = 400;
    throw err;
  }
  return code;
}

export function hearPacket(text, lang) {
  return { type: "hear", text, lang };
}

export function sentPacket(id) {
  return { type: "sent", id };
}

async function hop(ai, text, source, target) {
  const result = await ai.run(MODEL, {
    text,
    source_lang: source,
    target_lang: target
  });
  const out = result && (result.translated_text || result.translatedText);
  if (typeof out !== "string" || !out.trim()) {
    throw new Error("empty translation");
  }
  return out.trim();
}

/**
 * @param {{ run: Function }} ai
 * @param {string} text
 * @param {string} from
 * @param {string} to
 * @param {{ debug?: boolean }} [opts]
 * @returns {Promise<{ forListener: string, to: string, middle?: string }>}
 */
export async function forListener(ai, text, from, to, opts = {}) {
  const src = canon(from);
  const dst = canon(to);
  const clean = String(text || "").trim();
  if (!clean) {
    const err = new Error("text required");
    err.status = 400;
    throw err;
  }
  if (src === dst) {
    return { forListener: clean, to: dst };
  }

  const middle = src === MIDDLE ? clean : await hop(ai, clean, src, MIDDLE);
  const translated = dst === MIDDLE ? middle : await hop(ai, middle, MIDDLE, dst);
  const packet = { forListener: translated, to: dst };
  if (opts.debug) packet.middle = middle;
  return packet;
}
