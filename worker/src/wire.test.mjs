import assert from "node:assert/strict";
import test from "node:test";
import { canon, forListener, hearPacket, sentPacket } from "./translate.js";

test("igbo aliases land on ig", () => {
  assert.equal(canon("ig-NG"), "ig");
  assert.equal(canon("Igbo"), "ig");
});

test("same language does not call the model", async () => {
  let calls = 0;
  const ai = { run() { calls += 1; return { translated_text: "no" }; } };
  const out = await forListener(ai, "Kedu", "ig", "ig");
  assert.equal(out.forListener, "Kedu");
  assert.equal(calls, 0);
  assert.equal("middle" in out, false);
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

test("player packets never carry the source line", () => {
  assert.deepEqual(hearPacket("nnọọ", "ig"), { type: "hear", text: "nnọọ", lang: "ig" });
  assert.deepEqual(Object.keys(sentPacket("abc")), ["type", "id"]);
});
