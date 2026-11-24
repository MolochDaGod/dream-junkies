(function () {
  const data = window.DJ;
  if (!data) {
    document.body.textContent = "Chronicle data did not load.";
    return;
  }

  const chronicle = data.chronicle;
  const war = data.war;
  const placeByChapter = Object.create(null);
  for (const place of chronicle.places) placeByChapter[place.chapter] = place;

  const motion = chronicle.motion || {};
  const captions = motion.entranceCaptions || [];
  const entrance = motion.entrance || [];
  const beats = [];

  beats.push({
    kind: "card",
    kicker: "梦境编年史",
    title: "Dream Junkies",
    sub: "The ancient creature chronicle of the Dreamverse",
    ms: 2600,
    chapterId: "open"
  });

  entrance.forEach((src, i) => {
    beats.push({
      kind: "motion",
      src,
      kicker: "Opening",
      title: captions[i] || "Aurelia",
      sub: "",
      maxMs: 14000,
      chapterId: "open"
    });
  });

  if (motion.bookOpening) {
    beats.push({
      kind: "motion",
      src: motion.bookOpening,
      kicker: "The book",
      title: captions[3] || "The chronicle begins here.",
      sub: "Rem Forge",
      maxMs: 12000,
      chapterId: "open"
    });
  }

  let lastChapter = "";
  for (const plate of chronicle.plates) {
    if (plate.chapterId !== lastChapter) {
      const place = placeByChapter[plate.chapterId];
      beats.push({
        kind: "card",
        kicker: plate.chapterLabel,
        title: plate.chapterTitle,
        sub: place ? place.note : "",
        ms: 2400,
        chapterId: plate.chapterId
      });
      lastChapter = plate.chapterId;
    }
    beats.push({
      kind: "plate",
      image: plate.image,
      kicker: plate.chapterLabel + " · page " + plate.pageNumber,
      title: plate.chapterTitle,
      sub: plate.pageCount > 1 ? "Page " + plate.pageNumber + " of " + plate.pageCount : "",
      speech: plate.speech || [],
      ms: 6800,
      chapterId: plate.chapterId,
      alt: plate.chapterTitle + ", page " + plate.pageNumber
    });
  }

  beats.push({
    kind: "card",
    kicker: chronicle.finale.label,
    title: chronicle.finale.title,
    sub: chronicle.finale.note,
    ms: 4200,
    chapterId: "finale"
  });

  beats.push({
    kind: "roster",
    kicker: "The war",
    title: "Generation captains",
    sub: "Each captain is a generation character. The statue trains only that captain's troops.",
    chapterId: "captains"
  });

  const frame = document.getElementById("frame");
  const motionEl = document.getElementById("motion");
  const plateEl = document.getElementById("plate");
  const artEl = document.getElementById("art");
  const cardEl = document.getElementById("card");
  const rosterEl = document.getElementById("roster");
  const voice = document.getElementById("voice");
  const kicker = document.getElementById("kicker");
  const line = document.getElementById("line");
  const sub = document.getElementById("sub");
  const where = document.getElementById("where");
  const count = document.getElementById("count");
  const barFill = document.getElementById("bar-fill");
  const playBtn = document.getElementById("play");
  const muteBtn = document.getElementById("mute");
  const drawer = document.getElementById("drawer");

  let beat = 0;
  let token = 0;
  let playing = true;
  let muted = false;
  let speechAt = 0;
  let timer = 0;
  const drifts = ["drift-a", "drift-b", "drift-c", "drift-d"];

  const chapterStarts = [];
  const seen = new Set();
  beats.forEach((b, i) => {
    if (!seen.has(b.chapterId)) {
      seen.add(b.chapterId);
      chapterStarts.push({ id: b.chapterId, index: i, label: b.kicker || b.chapterId });
    }
  });

  for (const ch of chapterStarts) {
    if (ch.id === "open" || ch.id === "finale" || ch.id === "captains") continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = ch.label.replace("Chapter ", "");
    btn.dataset.index = String(ch.index);
    btn.addEventListener("click", () => go(ch.index));
    drawer.appendChild(btn);
  }

  function setCaption(b) {
    kicker.textContent = b.kicker || "";
    line.textContent = b.title || "";
    sub.textContent = b.sub || "";
    where.textContent = b.kicker || "Chronicle";
  }

  function hideAll() {
    motionEl.hidden = true;
    plateEl.hidden = true;
    cardEl.hidden = true;
    rosterEl.hidden = true;
    motionEl.pause();
    voice.pause();
  }

  function stopTimers() {
    clearTimeout(timer);
    timer = 0;
  }

  function finish(my) {
    if (my !== token || !playing) return;
    go(Math.min(beats.length - 1, beat + 1), true);
  }

  function arm(my) {
    const b = beats[beat];
    if (!playing) return;
    if (b.kind === "motion") {
      motionEl.onended = () => finish(my);
      const play = motionEl.play();
      if (play && play.catch) {
        play.catch(() => {
          if (my !== token) return;
          motionEl.muted = true;
          muted = true;
          muteBtn.textContent = "Hear it";
          motionEl.play().catch(() => { timer = setTimeout(() => finish(my), 2800); });
        });
      }
      timer = setTimeout(() => finish(my), b.maxMs);
      return;
    }
    if (b.kind === "plate" && !muted && b.speech.length) {
      playSpeech(b, my);
      timer = setTimeout(() => finish(my), 42000);
      return;
    }
    if (b.kind === "roster") return;
    timer = setTimeout(() => finish(my), b.ms || 3000);
  }

  function playSpeech(b, my) {
    if (speechAt >= b.speech.length) {
      finish(my);
      return;
    }
    voice.src = b.speech[speechAt];
    voice.onended = () => {
      if (my !== token) return;
      speechAt += 1;
      if (speechAt >= b.speech.length) finish(my);
      else playSpeech(b, my);
    };
    const play = voice.play();
    if (play && play.catch) {
      play.catch(() => {
        if (my !== token) return;
        muted = true;
        muteBtn.textContent = "Hear it";
        timer = setTimeout(() => finish(my), b.ms || 6800);
      });
    }
  }

  function renderRoster() {
    rosterEl.innerHTML = "";
    const h = document.createElement("h2");
    h.textContent = "Generation captains";
    const p = document.createElement("p");
    p.className = "lede";
    p.textContent = "Stick Wars, retold. The statue is the NFT captain. $DREAM trains the troop. Dream Essence and that captain's lore item upgrade it.";
    const grid = document.createElement("div");
    grid.className = "roster-grid";
    for (const captain of war.captains) {
      const btn = document.createElement("button");
      btn.type = "button";
      if (captain.portrait) {
        const img = document.createElement("img");
        img.src = captain.portrait;
        img.alt = captain.name;
        btn.appendChild(img);
      }
      const name = document.createElement("span");
      name.textContent = "GEN" + captain.gen + " " + captain.name;
      btn.appendChild(name);
      btn.addEventListener("click", () => openTree(captain));
      grid.appendChild(btn);
    }
    rosterEl.append(h, p, grid);
  }

  function openTree(captain) {
    playing = false;
    playBtn.textContent = "Play";
    stopTimers();
    token += 1;
    voice.pause();
    const old = document.getElementById("tree");
    if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.id = "tree";
    const sheet = document.createElement("div");
    sheet.className = "tree-sheet";
    const h = document.createElement("h3");
    h.textContent = captain.name + " · GEN" + captain.gen;
    const role = document.createElement("p");
    role.textContent = captain.role + " — " + captain.power;
    const blurb = document.createElement("p");
    blurb.textContent = captain.blurb;
    const list = document.createElement("ol");
    for (const node of captain.tree) {
      const li = document.createElement("li");
      const tier = document.createElement("div");
      tier.className = "tier";
      tier.textContent = node.stickRole === "captain-rite" ? "Rite" : "Tier " + node.tier;
      const body = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = node.skill;
      const duty = document.createElement("div");
      duty.textContent = node.name + ". " + node.duty;
      const cost = document.createElement("div");
      cost.className = "cost";
      const train = node.train ? node.train.dream + " $DREAM to train. " : "No summon. ";
      cost.textContent = train + node.upgrade.essence + " Dream Essence and one " + node.upgrade.loreItem + " to upgrade.";
      body.append(title, duty, cost);
      li.append(tier, body);
      list.appendChild(li);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => wrap.remove());
    sheet.append(h, role, blurb, list, close);
    wrap.appendChild(sheet);
    wrap.addEventListener("click", (event) => {
      if (event.target === wrap) wrap.remove();
    });
    document.body.appendChild(wrap);
  }

  function preload(index) {
    const nxt = beats[index + 1];
    if (nxt && nxt.image) {
      const img = new Image();
      img.src = nxt.image;
    }
  }

  function go(index, fromAuto) {
    if (index < 0 || index >= beats.length) return;
    if (fromAuto && index === beat) return;
    token += 1;
    const my = token;
    stopTimers();
    speechAt = 0;
    beat = index;
    const b = beats[beat];
    hideAll();
    setCaption(b);
    count.textContent = (beat + 1) + " / " + beats.length;
    barFill.style.width = ((beat + 1) / beats.length * 100) + "%";
    drawer.querySelectorAll("button").forEach((btn) => {
      const start = beats[Number(btn.dataset.index)];
      btn.classList.toggle("is-on", !!start && start.chapterId === b.chapterId);
    });

    if (b.kind === "motion") {
      motionEl.hidden = false;
      motionEl.muted = muted;
      motionEl.src = b.src;
    } else if (b.kind === "plate") {
      plateEl.hidden = false;
      plateEl.className = drifts[beat % drifts.length];
      const hold = Math.max(6.8, (b.speech.length || 1) * 7);
      plateEl.style.setProperty("--hold", hold + "s");
      artEl.alt = b.alt;
      artEl.src = b.image;
    } else if (b.kind === "roster") {
      rosterEl.hidden = true;
      rosterEl.hidden = false;
      renderRoster();
    } else {
      cardEl.hidden = false;
      cardEl.innerHTML = "";
      const seal = document.createElement("p");
      seal.className = "seal";
      seal.textContent = "卷";
      const h = document.createElement("h2");
      h.textContent = b.title;
      cardEl.append(seal, h);
      if (b.sub) {
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = b.sub;
        cardEl.appendChild(note);
      }
    }
    preload(beat);
    if (playing) arm(my);
  }

  function togglePlay() {
    playing = !playing;
    playBtn.textContent = playing ? "Pause" : "Play";
    if (!playing) {
      token += 1;
      stopTimers();
      motionEl.pause();
      voice.pause();
      return;
    }
    const my = ++token;
    const b = beats[beat];
    if (b.kind === "motion") {
      motionEl.play().catch(() => {});
      motionEl.onended = () => finish(my);
      timer = setTimeout(() => finish(my), b.maxMs || 14000);
      return;
    }
    if (b.kind === "plate" && !muted && b.speech.length && speechAt < b.speech.length && voice.src) {
      voice.play().then(() => {
        voice.onended = () => {
          if (my !== token) return;
          speechAt += 1;
          if (speechAt >= b.speech.length) finish(my);
          else playSpeech(b, my);
        };
      }).catch(() => { timer = setTimeout(() => finish(my), b.ms || 6800); });
      timer = setTimeout(() => finish(my), 42000);
      return;
    }
    arm(my);
  }

  playBtn.addEventListener("click", togglePlay);
  document.getElementById("next").addEventListener("click", () => go(beat + 1));
  document.getElementById("prev").addEventListener("click", () => go(beat - 1));
  document.getElementById("skip").addEventListener("click", () => {
    const id = beats[beat].chapterId;
    for (let i = beat + 1; i < beats.length; i++) {
      if (beats[i].chapterId !== id) {
        go(i);
        return;
      }
    }
  });
  document.getElementById("captains").addEventListener("click", () => {
    const i = beats.findIndex((b) => b.kind === "roster");
    if (i >= 0) go(i);
  });
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.textContent = muted ? "Sound off" : "Sound on";
    motionEl.muted = muted;
    voice.muted = muted;
    if (muted) voice.pause();
  });

  window.addEventListener("keydown", (event) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (event.key === "ArrowRight") go(beat + 1);
    else if (event.key === "ArrowLeft") go(beat - 1);
    else if (event.key === " ") {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "m" || event.key === "M") muteBtn.click();
  });

  frame.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    const x = event.clientX / window.innerWidth;
    if (x < 0.28) go(beat - 1);
    else if (x > 0.72) go(beat + 1);
  });

  go(0);
})();
