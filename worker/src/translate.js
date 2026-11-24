/**
 * English is the middle ground.
 * Peers receive only their language. The pivot stays with the sender.
 * M2M100 returns no confidence score, so model lines are marked approx.
 * Nigerian Pidgin is glossary-only: the model has no pcm code.
 */

import { calloutById, calloutLine, filterProfanity, splitCallouts } from "./glossary.js";

export const MIDDLE = "en";
export const MODEL = "@cf/meta/m2m100-1.2b";
export const MODEL_CONFIDENCE = 0.55;
export const APPROX_BELOW = 0.7;

export const LANGUAGES = [
  { code: "ig", name: "Igbo", region: "Nigeria", play: true, machine: true },
  { code: "en", name: "English", region: "middle", play: true, machine: true },
  { code: "pcm", name: "Nigerian Pidgin", region: "Nigeria", play: true, machine: false },
  { code: "yo", name: "Yoruba", region: "Nigeria", play: true, machine: true },
  { code: "ha", name: "Hausa", region: "Nigeria", play: true, machine: true },
  { code: "fr", name: "French", play: true, machine: true },
  { code: "es", name: "Spanish", play: true, machine: true },
  { code: "pt", name: "Portuguese", play: true, machine: true },
  { code: "zh", name: "Chinese", play: true, machine: true },
  { code: "ja", name: "Japanese", play: true, machine: true },
  { code: "ar", name: "Arabic", play: true, machine: true },
  { code: "de", name: "German", play: true, machine: true },
  { code: "hi", name: "Hindi", play: true, machine: true },
  { code: "ko", name: "Korean", play: true, machine: true },
  { code: "ru", name: "Russian", play: true, machine: true },
  { code: "sw", name: "Swahili", play: true, machine: true }
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
ALIAS.set("pidgin", "pcm");
ALIAS.set("naija", "pcm");
ALIAS.set("nigerian-pidgin", "pcm");

const BY_CODE = new Map(LANGUAGES.map((lang) => [lang.code, lang]));

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

export function language(code) {
  return BY_CODE.get(canon(code));
}

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

async function hop(ai, text, source, target) {
  const result = await ai.run(MODEL, {
    text,
    source_lang: source,
    target_lang: target
  });
  const out = result && (result.translated_text || result.translatedText);
  if (typeof out !== "string" || !out.trim()) fail("empty translation", 502);
  return out.trim();
}

function finish(text, confidence) {
  return {
    text,
    confidence,
    approx: confidence < APPROX_BELOW
  };
}

/**
 * One pass to the English middle. Does not include a listener payload.
 * @returns {Promise<{ src: string, clean: string, pivot: string, confidence: number, approx: boolean, callout: object|null, parts: object[]|null, mock: boolean }>}
 */
export async function bridgeMessage(ai, text, from, opts = {}) {
  const src = canon(from);
  const clean = String(text || "").trim().slice(0, 500);
  const forced = opts.calloutId ? calloutById(opts.calloutId) : null;
  if (opts.calloutId && !forced) fail("unknown callout", 400);
  if (!clean && !forced) fail("text required", 400);

  if (forced) {
    const scored = finish(calloutLine(forced, MIDDLE), 1);
    return {
      src,
      clean: calloutLine(forced, src),
      pivot: scored.text,
      confidence: scored.confidence,
      approx: scored.approx,
      callout: forced,
      parts: null,
      mock: false
    };
  }

  const parts = splitCallouts(clean);
  const onlyCallout = parts.length === 1 && parts[0].callout;
  if (onlyCallout) {
    const scored = finish(calloutLine(parts[0].callout, MIDDLE), 1);
    return {
      src,
      clean,
      pivot: scored.text,
      confidence: scored.confidence,
      approx: scored.approx,
      callout: parts[0].callout,
      parts: null,
      mock: false
    };
  }

  const srcLang = language(src);
  let confidence = 1;
  for (const part of parts) {
    if (part.callout) continue;
    if (opts.mock) {
      part.pivot = src === MIDDLE ? part.text : `(middle from ${src})`;
      part.mock = true;
      confidence = Math.min(confidence, 0.5);
      continue;
    }
    if (src === MIDDLE) {
      part.pivot = part.text;
      continue;
    }
    if (!srcLang.machine) {
      part.pivot = part.text;
      part.weak = true;
      confidence = Math.min(confidence, 0.4);
      continue;
    }
    part.pivot = await hop(ai, part.text, src, MIDDLE);
    confidence = Math.min(confidence, MODEL_CONFIDENCE);
  }

  const pivot = parts
    .map((part) => (part.callout ? calloutLine(part.callout, MIDDLE) : part.pivot))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const scored = finish(pivot, confidence);
  return {
    src,
    clean,
    pivot: scored.text,
    confidence: scored.confidence,
    approx: scored.approx,
    callout: null,
    parts,
    mock: Boolean(opts.mock)
  };
}

/** Listener text only. Never returns the pivot. */
export async function renderFor(ai, bridged, to, opts = {}) {
  const dst = canon(to);
  const dstLang = language(dst);
  let rendered;

  if (bridged.callout) {
    const line = calloutLine(bridged.callout, dst);
    const known = Boolean(bridged.callout.text[dst]);
    rendered = finish(line, known ? 1 : 0.4);
  } else if (!bridged.parts?.some((part) => part.callout) && dst === bridged.src) {
    rendered = finish(bridged.clean, 1);
  } else {
    const chunks = [];
    let confidence = bridged.confidence;
    for (const part of bridged.parts || []) {
      if (part.callout) {
        const known = Boolean(part.callout.text[dst]);
        chunks.push(calloutLine(part.callout, dst));
        if (!known) confidence = Math.min(confidence, 0.4);
        continue;
      }
      if (dst === bridged.src && !part.mock) {
        chunks.push(part.text);
        continue;
      }
      if (dst === MIDDLE || !dstLang.machine) {
        chunks.push(part.pivot);
        if (!dstLang.machine && dst !== MIDDLE) confidence = Math.min(confidence, 0.35);
        continue;
      }
      if (part.mock || bridged.mock) {
        chunks.push(`(${dst}) ${part.pivot}`);
        confidence = Math.min(confidence, 0.5);
        continue;
      }
      chunks.push(await hop(ai, part.pivot, MIDDLE, dst));
      confidence = Math.min(confidence, MODEL_CONFIDENCE);
    }
    rendered = finish(chunks.join(" ").replace(/\s+/g, " ").trim(), confidence);
  }

  const text = opts.filter ? filterProfanity(rendered.text) : rendered.text;
  return { text, lang: dst, confidence: rendered.confidence, approx: rendered.approx };
}

export function hearPacket(fields) {
  return {
    type: "hear",
    text: fields.text,
    lang: fields.lang,
    confidence: fields.confidence,
    approx: Boolean(fields.approx),
    name: fields.name,
    ts: fields.ts
  };
}

export function sentPacket(fields) {
  return {
    type: "sent",
    id: fields.id,
    pivot: fields.pivot,
    confidence: fields.confidence,
    approx: Boolean(fields.approx)
  };
}

/**
 * REST shape. `middle` is returned only when debug is set.
 * The socket path does not use this for peers.
 */
export async function forListener(ai, text, from, to, opts = {}) {
  const src = canon(from);
  const dst = canon(to);
  const clean = String(text || "").trim().slice(0, 500);
  if (!clean) fail("text required", 400);
  if (src === dst && !opts.mock && !splitCallouts(clean).some((part) => part.callout)) {
    const line = opts.filter ? filterProfanity(clean) : clean;
    const packet = { forListener: line, to: dst, confidence: 1, approx: false };
    if (opts.debug) packet.middle = line;
    return packet;
  }
  const bridged = await bridgeMessage(ai, text, from, { mock: opts.mock });
  const rendered = await renderFor(ai, bridged, to, { filter: opts.filter });
  const packet = {
    forListener: rendered.text,
    to: rendered.lang,
    confidence: rendered.confidence,
    approx: rendered.approx
  };
  if (opts.debug) packet.middle = bridged.pivot;
  return packet;
}
