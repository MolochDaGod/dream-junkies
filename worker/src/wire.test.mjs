import assert from "node:assert/strict";
import test from "node:test";
import { filterProfanity, roomCode, splitCallouts } from "./glossary.js";
import { bridgeMessage, canon, forListener, hearPacket, renderFor, sentPacket } from "./translate.js";

test("igbo and pidgin aliases land on the config codes", () => {
  assert.equal(canon("ig-NG"), "ig");
  assert.equal(canon("Igbo"), "ig");
  assert.equal(canon("Naija"), "pcm");
  assert.equal(canon("nigerian pidgin"), "pcm");
});

test("same language does not call the model", async () => {
  let calls = 0;
  const ai = { run() { calls += 1; return { translated_text: "no" }; } };
  const out = await forListener(ai, "Kedu", "ig", "ig");
  assert.equal(out.forListener, "Kedu");
  assert.equal(calls, 0);
  assert.equal("middle" in out, false);
  assert.equal(out.approx, false);
});

test("cross language pivots through English and hides the middle", async () => {
  const calls = [];
  const ai = {
    async run(_model, input) {
      calls.push(input);
      return { translated_text: input.target_lang === "en" ? "hello" : "bonjour" };
    }
  };
  const out = await forListener(ai, "Kedu", "ig", "fr");
  assert.deepEqual(calls.map((c) => [c.source_lang, c.target_lang]), [
    ["ig", "en"],
    ["en", "fr"]
  ]);
  assert.equal(out.forListener, "bonjour");
  assert.equal(out.to, "fr");
  assert.equal("middle" in out, false);
  assert.equal(out.approx, true);
});

test("debug keeps the middle for development only", async () => {
  const ai = {
    async run(_model, input) {
      return { translated_text: input.target_lang === "en" ? "hello" : "nnọọ" };
    }
  };
  const out = await forListener(ai, "Hello", "en", "ig", { debug: true });
  assert.equal(out.forListener, "nnọọ");
  assert.equal(out.middle, "Hello");
});

test("player packets never carry the source line or the pivot to peers", () => {
  const hear = hearPacket({
    text: "Gwọọ m",
    lang: "ig",
    confidence: 1,
    approx: false,
    name: "Ada",
    ts: 1
  });
  assert.deepEqual(Object.keys(hear).sort(), ["approx", "confidence", "lang", "name", "text", "ts", "type"]);
  assert.equal("pivot" in hear, false);
  const sent = sentPacket({ id: "abc", pivot: "Heal me", confidence: 1, approx: false });
  assert.deepEqual(Object.keys(sent).sort(), ["approx", "confidence", "id", "pivot", "type"]);
  assert.equal(sent.pivot, "Heal me");
  assert.equal("text" in sent, false);
});

test("a callout skips the model and stays hand-written", async () => {
  let calls = 0;
  const ai = { run() { calls += 1; return { translated_text: "no" }; } };
  const bridged = await bridgeMessage(ai, "gg", "ig");
  assert.equal(bridged.pivot, "Good game");
  assert.equal(calls, 0);
  const heard = await renderFor(ai, bridged, "yo");
  assert.equal(heard.text, "Ere rere");
  assert.equal(heard.approx, false);
  assert.equal("pivot" in heard, false);
});

test("a callout inside a sentence is not sent through the model", async () => {
  const calls = [];
  const ai = {
    async run(_model, input) {
      calls.push(input.text);
      return { translated_text: "à la porte" };
    }
  };
  const bridged = await bridgeMessage(ai, "Heal me at the gate", "en");
  const heard = await renderFor(ai, bridged, "fr");
  assert.deepEqual(calls, ["at the gate"]);
  assert.equal(heard.text, "Soigne-moi à la porte");
  assert.equal(bridged.pivot, "Heal me at the gate");
});

test("pidgin free text is not a model language", async () => {
  let calls = 0;
  const ai = {
    async run() {
      calls += 1;
      return { translated_text: "ndewo" };
    }
  };
  const fromEnglish = await bridgeMessage(ai, "Hold the line", "en");
  const heard = await renderFor(ai, fromEnglish, "pcm");
  assert.equal(heard.text, "Hold the line");
  assert.equal(heard.approx, true);
  assert.equal(calls, 0);
  const fromPidgin = await bridgeMessage(ai, "How far", "pcm");
  const igbo = await renderFor(ai, fromPidgin, "ig");
  assert.equal(igbo.text, "ndewo");
  assert.equal(igbo.text.includes("How far"), false);
  assert.equal(calls, 1);
  assert.equal(igbo.approx, true);
});

test("mock mode does not send the raw foreign line", async () => {
  let calls = 0;
  const ai = { run() { calls += 1; return { translated_text: "no" }; } };
  const out = await forListener(ai, "Kedu", "ig", "fr", { mock: true });
  assert.equal(calls, 0);
  assert.equal(out.forListener.includes("Kedu"), false);
  assert.match(out.forListener, /\(fr\)/);
});

test("profanity filter runs on the listener line", async () => {
  const ai = { async run() { return { translated_text: "no" }; } };
  const out = await forListener(ai, "holy shit", "en", "en", { filter: true });
  assert.equal(out.forListener, "holy □□□");
  assert.equal(filterProfanity("shit"), "□□□");
});

test("room codes are six unambiguous characters", () => {
  const code = roomCode(() => 0);
  assert.equal(code, "aaaaaa");
  assert.equal(roomCode(() => 0.999).length, 6);
  assert.match(roomCode(Math.random), /^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/);
});

test("egg does not swallow the gg callout", () => {
  const parts = splitCallouts("egg");
  assert.equal(parts.length, 1);
  assert.equal(parts[0].text, "egg");
});
