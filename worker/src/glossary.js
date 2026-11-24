/** Hand callouts run before the model. Keys are matched whole, longest first. */

export const CALLOUTS = [
  {
    id: "gg",
    text: {
      en: "Good game",
      ig: "Egwuregwu ọma",
      yo: "Ere rere",
      ha: "Wasa mai kyau",
      pcm: "Good game",
      fr: "Bien joué",
      es: "Buena partida",
      pt: "Bom jogo"
    }
  },
  {
    id: "rush-b",
    text: {
      en: "Rush B",
      ig: "Gbaa ọsọ gaa B",
      yo: "Sáré lọ sí B",
      ha: "Gudu zuwa B",
      pcm: "Rush B",
      fr: "Rush B",
      es: "Rush B",
      pt: "Rush B"
    }
  },
  {
    id: "heal",
    text: {
      en: "Heal me",
      ig: "Gwọọ m",
      yo: "Wò mí sàn",
      ha: "Warkar da ni",
      pcm: "Abeg heal me",
      fr: "Soigne-moi",
      es: "Cúrame",
      pt: "Cura-me"
    }
  },
  {
    id: "enemy-left",
    text: {
      en: "Enemy left",
      ig: "Onye iro nọ n'aka ekpe",
      yo: "Ọ̀tá wà ní òsì",
      ha: "Maƙiyi na hagu",
      pcm: "Enemy dey for left",
      fr: "Ennemi à gauche",
      es: "Enemigo a la izquierda",
      pt: "Inimigo à esquerda"
    }
  },
  {
    id: "push",
    text: {
      en: "Push",
      ig: "Gaba n'ihu",
      yo: "Tẹ̀ síwájú",
      ha: "Ci gaba",
      pcm: "Make we push",
      fr: "On pousse",
      es: "Empujad",
      pt: "Avançar"
    }
  },
  {
    id: "retreat",
    text: {
      en: "Retreat",
      ig: "Laghachi azụ",
      yo: "Padà sẹ́yìn",
      ha: "Koma baya",
      pcm: "Make we pull back",
      fr: "On se replie",
      es: "Retirada",
      pt: "Recuar"
    }
  },
  {
    id: "ammo",
    text: {
      en: "Need ammo",
      ig: "Achọrọ m mgbọ",
      yo: "Mo nílò ìbọn",
      ha: "Ina bukatar harsashi",
      pcm: "I need ammo",
      fr: "Besoin de munitions",
      es: "Necesito munición",
      pt: "Preciso de munição"
    }
  }
];

const EXTRA_KEYS = {
  gg: ["gg"],
  "rush-b": ["rush b"],
  heal: ["heal me"],
  "enemy-left": ["enemy left"],
  push: ["push"],
  retreat: ["retreat"],
  ammo: ["need ammo"]
};

function norm(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[!.?]+$/g, "")
    .replace(/\s+/g, " ");
}

function isWordChar(ch) {
  return /[\p{L}\p{N}]/u.test(ch || "");
}

const KEYS = [];
for (const callout of CALLOUTS) {
  const seen = new Set();
  const add = (key) => {
    const clean = norm(key);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    KEYS.push({ key: clean, callout });
  };
  for (const line of Object.values(callout.text)) add(line);
  for (const key of EXTRA_KEYS[callout.id] || []) add(key);
}
KEYS.sort((a, b) => b.key.length - a.key.length);

const BY_ID = new Map(CALLOUTS.map((callout) => [callout.id, callout]));

export function calloutById(id) {
  return BY_ID.get(String(id || "")) || null;
}

export function calloutLine(callout, lang) {
  return callout.text[lang] || callout.text.en;
}

/** Split a line into callout spans and free-text spans. Longest phrase wins. */
export function splitCallouts(text) {
  const original = String(text || "").trim().replace(/\s+/g, " ");
  const source = original.toLowerCase();
  const parts = [];
  let i = 0;
  while (i < source.length) {
    while (i < source.length && !isWordChar(source[i])) i += 1;
    if (i >= source.length) break;
    let found = null;
    for (const entry of KEYS) {
      if (!source.startsWith(entry.key, i)) continue;
      const end = i + entry.key.length;
      if (isWordChar(source[end])) continue;
      if (i > 0 && isWordChar(source[i - 1])) continue;
      found = { callout: entry.callout, end };
      break;
    }
    if (found) {
      parts.push({ callout: found.callout });
      i = found.end;
      continue;
    }
    let j = i + 1;
    while (j < source.length) {
      let next = false;
      if (isWordChar(source[j]) && !isWordChar(source[j - 1])) {
        for (const entry of KEYS) {
          if (!source.startsWith(entry.key, j)) continue;
          if (isWordChar(source[j + entry.key.length])) continue;
          next = true;
          break;
        }
      }
      if (next) break;
      j += 1;
    }
    const slice = original.slice(i, j).trim();
    if (slice) parts.push({ text: slice });
    i = j;
  }
  return parts;
}

const SWEAR = /\b(?:fuck\w*|shit\w*|bitch\w*|assholes?|bastards?|nigg(?:a|er)s?|motherfuckers?|putain|merde|putas?|mierda|caralho|fodas?)\b/giu;

export function filterProfanity(text) {
  return String(text || "").replace(SWEAR, "□□□");
}

const ROOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function roomCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
  }
  return code;
}
