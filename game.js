/* ============================================================
 * 修仙模拟器 · 界面与主流程 v2（原创实现）
 * 视图 / 年循环 / 觉醒仪式 / 抉择 / 天降机缘 / 心魔 / 渡劫拔河 /
 * 宿敌并行 / 弹幕 / 机器人榜超越 / 转世遗泽 / 每日同参 / 后悔钩子
 * ============================================================ */
(function () {
  var D = window.DATA, Sim = window.Sim;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 存档（本地） ---------------- */
  var STORE_KEY = "xxsim_save_v1";
  var save = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && typeof s === "object") {
        if (!s.legacy) s.legacy = null;
        if (s.danmaku === undefined) s.danmaku = true;
        if (!s.daily) s.daily = { date: "", done: false };
        if (!s.codex) s.codex = { roots: {}, xy: {}, lg: {} };
        if (!s.codex.roots) s.codex.roots = {};
        if (!s.codex.xy) s.codex.xy = {};
        if (!s.codex.lg) s.codex.lg = {};
        if (!s.streak) s.streak = { last: "", n: 0 };
        if (!s.chal) s.chal = { w: 0, l: 0 };
        return s;
      }
    } catch (e) {}
    return {
      playerLv: 0, playerExp: 0,
      runs: 0, ascends: 0,
      ach: {}, board: [],
      sound: true, speed: 0.1, danmaku: true,
      everXianyuan: false,
      legacy: null,                 /* { key: true } 转世遗泽 */
      daily: { date: "", done: false },
      codex: { roots: {}, xy: {}, lg: {} },   /* 图鉴收集 */
      streak: { last: "", n: 0 },             /* 连续签到 */
      chal: { w: 0, l: 0 }                    /* 挑战码战绩 */
    };
  }
  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch (e) {} }

  /* 首次进入用机器人填充仙榜，营造竞争感 */
  function seedBoard() {
    if (save.board && save.board.length) return;
    save.board = D.BOTS.map(function (b) {
      return {
        name: b.name, root: b.name, apt: 7, lvl: b.lvl,
        realm: D.REALMS[Sim.realmOf(b.lvl)], combat: b.combat,
        age: 200, ascend: !!b.ascend, xy: "", bot: true
      };
    });
    persist();
  }

  function achBonus() {
    var b = 0;
    D.ACHIEVEMENTS.forEach(function (a) { if (save.ach[a.id]) b += a.bonus; });
    return b;
  }

  /* ---------------- 音效 ---------------- */
  var actx = null;
  function beep(freq, dur, type, vol) {
    if (!save.sound) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.15));
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.15) + 0.02);
    } catch (e) {}
  }
  function sUp() { beep(660, 0.12, "triangle"); }
  function sRealm() { beep(523, 0.1, "sine"); setTimeout(function () { beep(784, 0.18, "sine"); }, 90); }
  function sGold() { beep(880, 0.1, "sine"); setTimeout(function () { beep(1174, 0.22, "sine"); }, 90); }
  function sDown() { beep(196, 0.25, "sawtooth", 0.05); }
  function sTick() { beep(420 + Math.random() * 120, 0.05, "square", 0.05); }
  function sRival() { beep(300, 0.12, "sawtooth", 0.05); }
  function sAscend() { [523, 659, 784, 1046, 1318].forEach(function (f, i) { setTimeout(function () { beep(f, 0.28, "sine"); }, i * 120); }); }
  function soundFor(l) {
    if (l.type === "up") sUp(); else if (l.type === "realm") sRealm();
    else if (l.type === "gold") sGold(); else if (l.type === "down") sDown();
    else if (l.type === "ascend") sAscend(); else if (l.type === "rival") sRival();
    else if (l.type === "catch") sGold();
  }

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  function toast(html) {
    var t = $("ach-toast");
    t.innerHTML = html; t.hidden = false; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.hidden = true; }, 300); }, 2400);
  }

  /* ---------------- 视图 ---------------- */
  var views = ["view-home", "view-game", "view-settle", "view-rank", "view-ach", "view-codex", "view-settings", "view-about"];
  function show(id) {
    views.forEach(function (v) { $(v).classList.toggle("active", v === id); });
    window.scrollTo(0, 0);
  }

  /* ---------------- 首页 ---------------- */
  function legacyLabel() {
    if (!save.legacy) return null;
    for (var i = 0; i < D.LEGACIES.length; i++) if (save.legacy[D.LEGACIES[i].key]) return D.LEGACIES[i];
    return null;
  }
  function renderHome() {
    $("home-count").textContent = save.runs;
    $("home-ascend-count").textContent = save.ascends;
    var lv = save.playerLv, exp = save.playerExp, need = D.expNeed(lv + 1);
    $("home-lv").textContent = "[Lv." + lv + "]";
    $("home-lv-bonus").textContent = lv > 0 ? "（高阶灵根 +" + (lv * 0.1).toFixed(1) + "%）" : "";
    $("home-lv-exp").textContent = exp + "/" + need;
    $("home-lv-fill").style.width = Math.min(100, exp / need * 100) + "%";
    $("ach-tip").textContent = "成就增加高阶灵根概率：" + achBonus().toFixed(1) + "%";
    var lg = legacyLabel(), el = $("home-legacy");
    if (lg) { el.hidden = false; el.innerHTML = "🕯 已继承遗泽：<b>" + lg.name + "</b>　" + lg.desc; }
    else el.hidden = true;
    var today = dateStr();
    $("daily-tip").textContent = save.daily.date === today && save.daily.done
      ? "今日命格已挑战 · 明日再来" : "今日全体修士同一命格，来比比谁更强";
    /* 连续签到 */
    updateStreak();
    var st = $("home-streak");
    if (save.streak.n > 0) {
      st.hidden = false;
      st.innerHTML = "🔥 连续签到 <b>" + save.streak.n + "</b> 天<span class=\"streak-bonus\">高阶灵根 +" + streakBonus().toFixed(1) + "%</span>";
    } else st.hidden = true;
    /* 图鉴 / 挑战码按钮提示 */
    var cx = codexProgress();
    $("codex-tip").textContent = "已收集 " + cx.got + " / " + cx.total;
    $("chal-tip").textContent = save.chal.w + save.chal.l > 0
      ? ("挑战战绩 " + save.chal.w + " 胜 " + save.chal.l + " 负") : "同参一战，比拼战力";
  }
  function dateStr(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------------- 连续签到 ---------------- */
  function updateStreak() {
    var today = dateStr();
    if (save.streak.last === today) return;
    var yest = dateStr(new Date(Date.now() - 86400000));
    save.streak.n = (save.streak.last === yest) ? (save.streak.n + 1) : 1;
    save.streak.last = today;
    persist();
  }
  function streakBonus() { return Math.min(3, (save.streak.n || 0) * 0.3); }

  /* ---------------- 图鉴收集 ---------------- */
  function recordRoot(name) { if (!name) return; save.codex.roots[name] = (save.codex.roots[name] || 0) + 1; persist(); }
  function recordXY(name) { if (!name) return; save.codex.xy[name] = (save.codex.xy[name] || 0) + 1; persist(); }
  function recordLG(name) { if (!name) return; save.codex.lg[name] = true; persist(); }
  function codexProgress() {
    var total = 0, got = 0, apt, i;
    for (apt = 1; apt <= 10; apt++) {
      var g = D.ROOTS[apt] || [];
      for (i = 0; i < g.length; i++) { total++; if (save.codex.roots[g[i]]) got++; }
    }
    for (i = 0; i < D.XIAN_YUAN.length; i++) { total++; if (save.codex.xy[D.XIAN_YUAN[i].name]) got++; }
    for (i = 0; i < D.LEGACIES.length; i++) { total++; if (save.codex.lg[D.LEGACIES[i].name]) got++; }
    return { got: got, total: total };
  }
  var codexTab = "root";
  function renderCodex() {
    var prog = codexProgress();
    $("codex-total").textContent = "收集进度：" + prog.got + " / " + prog.total;
    var tabs = [{ id: "root", name: "🌱 灵根" }, { id: "xy", name: "✨ 仙缘" }, { id: "lg", name: "🕯 遗泽" }];
    $("codex-tabs").innerHTML = tabs.map(function (t) {
      return '<button class="codex-tab' + (t.id === codexTab ? " active" : "") + '" data-tab="' + t.id + '">' + t.name + "</button>";
    }).join("");
    Array.prototype.forEach.call($("codex-tabs").querySelectorAll(".codex-tab"), function (btn) {
      btn.onclick = function () { codexTab = btn.getAttribute("data-tab"); renderCodex(); };
    });
    var body = $("codex-body"), html = "", apt, i;
    if (codexTab === "root") {
      for (apt = 1; apt <= 10; apt++) {
        var g = D.ROOTS[apt] || [];
        html += '<div class="codex-group-title">资质 ' + apt + " · " + D.APT_TITLES[apt] + "</div><div class=\"codex-grid\">";
        for (i = 0; i < g.length; i++) {
          var c = save.codex.roots[g[i]] || 0;
          html += '<div class="codex-card' + (c ? " got" : " locked") + '">' +
            '<div class="cx-name">' + (c ? g[i] : "？？？") + "</div>" +
            '<div class="cx-count">' + (c ? "已觉醒 ×" + c : "未收集") + "</div></div>";
        }
        html += "</div>";
      }
    } else if (codexTab === "xy") {
      html += '<div class="codex-group-title">仙缘（90 级后天降，渡劫可走引仙台）</div><div class="codex-grid">';
      for (i = 0; i < D.XIAN_YUAN.length; i++) {
        var xy = D.XIAN_YUAN[i], cxy = save.codex.xy[xy.name] || 0;
        html += '<div class="codex-card' + (cxy ? " got" : " locked") + '">' +
          '<div class="cx-name">' + (cxy ? xy.name : "？？？") + "</div>" +
          '<div class="cx-count">' + (cxy ? "增幅 ×" + xy.rate + " · 得 ×" + cxy : "未收集") + "</div></div>";
      }
      html += "</div>";
    } else {
      html += '<div class="codex-group-title">转世遗泽（结算三选一，带入下一世）</div><div class="codex-grid">';
      for (i = 0; i < D.LEGACIES.length; i++) {
        var lg = D.LEGACIES[i], clg = !!save.codex.lg[lg.name];
        html += '<div class="codex-card' + (clg ? " got" : " locked") + '">' +
          '<div class="cx-name">' + lg.name + "</div>" +
          '<div class="cx-count">' + (clg ? lg.desc : "未铭刻") + "</div></div>";
      }
      html += "</div>";
    }
    body.innerHTML = html;
  }

  /* ---------------- 挑战码（异步 PK） ---------------- */
  function finalCombatOf(r) {
    if (!r) return 0;
    return r.ascended ? (r.finalCombat || Sim.combatOf(r)) : Sim.combatOf(r);
  }
  function makeChalCode() { return run.seed + "-" + finalCombatOf(run); }
  function parseChalCode(str) {
    if (!str) return null;
    var s = String(str).trim().toUpperCase();
    var idx = s.lastIndexOf("-");
    if (idx < 0) return null;
    var seed = s.slice(0, idx), score = s.slice(idx + 1);
    if (!/^[A-Z0-9]{4,8}$/.test(seed)) return null;
    if (!/^\d+$/.test(score)) return null;
    var n = parseInt(score, 10);
    if (!(n > 0)) return null;
    return { seed: seed, score: n };
  }
  function openChallenge() {
    $("chal-input").value = "";
    $("chal-record").innerHTML = save.chal.w + save.chal.l > 0
      ? ('当前挑战战绩：<span class="win">' + save.chal.w + " 胜</span> · <span class=\"lose\">" + save.chal.l + " 负</span>")
      : "还没有挑战记录，粘贴好友挑战码开战吧！";
    $("challenge-mask").hidden = false;
  }
  function copyText(txt, okMsg) {
    function ok() { toast(okMsg || "📋 已复制到剪贴板"); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) { toast(txt); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback);
    else fallback();
  }

  /* ---------------- 游戏主循环 ---------------- */
  var run = null, timer = null, paused = false, finished = false, interacting = false;
  var catchTimer = null, tribRaf = null, demonRaf = null, awakenRaf = null, dmTimer = null;
  var dailyMode = false, chalMode = false, chalTarget = 0;

  function startGame(mode, seedOverride, targetScore) {
    dailyMode = (mode === "daily");
    chalMode = (mode === "challenge");
    chalTarget = chalMode ? (targetScore || 0) : 0;
    var seed;
    if (chalMode && seedOverride) seed = seedOverride;
    else if (dailyMode) seed = "XXSIM-DAILY-" + dateStr();
    else seed = randSeedStr();
    Sim.setRng(Sim.mulberry32(Sim.hashStr(seed)));
    run = Sim.newRun(save.playerLv, achBonus() + streakBonus(), { legacy: save.legacy || {} });
    run.seed = seed; run.chalTarget = chalTarget;
    run.rivalShown = 0; run.passedBots = {};
    /* 图鉴：记录本次觉醒的灵根 */
    recordRoot(run.root);
    finished = false; paused = false; interacting = false;
    $("log-box").innerHTML = "";
    $("combo-badge").hidden = true;
    renderAttrs(); updateRivalBar();
    show("view-game");
    /* 觉醒仪式：长按蓄力后再揭晓灵根并开跑 */
    openAwaken(function () {
      appendLog(run.log[0]);
      startDanmaku();
      loop();
    });
  }

  /* 随机种子串（普通局每局不同；挑战码复用同一串以还原命格） */
  function randSeedStr() {
    var s = Math.random().toString(36).slice(2, 8).toUpperCase();
    while (s.length < 5) s += "X";
    return s.slice(0, 5);
  }

  function renderAttrs() {
    if (!run) return;
    var realm = D.REALMS[Sim.realmOf(run.lvl)];
    $("attr-title").textContent = realm;
    $("attr-lvl").textContent = run.lvl + (run.lvl >= 99 ? "" : "（" + Sim.stageName(run.lvl) + "）");
    $("attr-apt").textContent = run.apt;
    $("attr-life").textContent = run.age + " / " + run.lifeMax;
    $("attr-combat").textContent = Sim.fmtNum(Sim.combatOf(run));
  }

  function updateCombo() {
    var b = $("combo-badge");
    if (run.combo >= 2) { b.hidden = false; $("combo-num").textContent = run.combo; b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; }
    else b.hidden = true;
  }

  function updateRivalBar() {
    if (!run || !run.rival) return;
    $("rival-name").textContent = run.rival.name;
    $("rival-lvl-you").textContent = run.lvl;
    $("rival-fill-you").style.width = Math.min(100, run.lvl / 99 * 100) + "%";
    var foeLvl = run.foeLvl || 1;
    $("rival-lvl-foe").textContent = run.rivalDone ? run.rival.finalLvl : foeLvl;
    $("rival-fill-foe").style.width = Math.min(100, foeLvl / 99 * 100) + "%";
  }

  function appendLog(entry) {
    var box = $("log-box");
    var div = document.createElement("div");
    div.className = "log-line log-" + (entry.type || "plain");
    var ageTag = document.createElement("span");
    ageTag.className = "log-age"; ageTag.textContent = entry.age + " 岁";
    var txt = document.createElement("span"); txt.textContent = entry.text;
    div.appendChild(ageTag); div.appendChild(txt);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  /* 宿敌里程碑：按年龄插入日志 */
  function showRivalMilestones() {
    if (!run || !run.rival) return;
    var tl = run.rival.timeline;
    while (run.rivalShown < tl.length && tl[run.rivalShown].age <= run.age) {
      var m = tl[run.rivalShown++];
      run.foeLvl = m.lvl;
      if (m.text.indexOf("飞升") >= 0 || m.text.indexOf("坐化") >= 0) run.rivalDone = true;
      run.log.push(m); appendLog(m); sRival();
    }
    updateRivalBar();
  }

  function loop() {
    clearTimeout(timer);
    if (!run || finished || paused || interacting) return;
    timer = setTimeout(function () {
      var logs = Sim.stepYear(run);
      var pending = null;
      logs.forEach(function (l) {
        run.log.push(l); appendLog(l); soundFor(l);
        if (l.type === "choice") pending = { kind: "choice", choice: l.choice };
        else if (l.type === "catch") pending = { kind: "catch", item: l.item };
      });
      showRivalMilestones();
      renderAttrs(); updateCombo(); checkSurpass();
      if (run.dead || run.ascended) { finishRun(); return; }
      if (pending && pending.kind === "choice") { openChoice(pending.choice); return; }
      if (pending && pending.kind === "catch") { openCatch(pending.item); return; }
      if (run.tribYear) { openTrib(); return; }
      if (Sim.realmOf(run.lvl) >= 2 && run.age - (run.lastInteractAge || 0) >= Sim.interactCd(run.lvl) && Sim.rnd() < 0.008) {
        run.lastInteractAge = run.age; openDemon(); return;
      }
      loop();
    }, save.speed * 1000);
  }

  /* ---------------- 机器人榜超越提示 ---------------- */
  var botLadder = null;
  function checkSurpass() {
    if (!run) return;
    if (!botLadder) botLadder = D.BOTS.slice().sort(function (a, b) { return a.combat - b.combat; });
    var c = Sim.combatOf(run);
    for (var i = 0; i < botLadder.length; i++) {
      var b = botLadder[i];
      if (c >= b.combat && !run.passedBots[b.name]) {
        run.passedBots[b.name] = true;
        toast("⚔ 战力超越「" + b.name + "」！");
        sGold();
      }
    }
  }

  /* ---------------- 觉醒仪式（长按蓄力） ---------------- */
  function openAwaken(onDone) {
    interacting = true;
    var mask = $("awaken-mask"); mask.hidden = false;
    var res = $("awaken-result"); res.hidden = true;
    var btn = $("btn-awaken"); btn.hidden = false; btn.textContent = "按住蓄力";
    var fillPct = 0, holding = false, done = false;
    function setRing(v) {
      $("awaken-fill").style.background = "conic-gradient(var(--gold) " + (v * 3.6) + "deg, rgba(245,201,107,0.08) " + (v * 3.6) + "deg)";
      $("awaken-core").style.boxShadow = "inset 0 0 " + (10 + v * 0.4) + "px rgba(245,201,107," + (v / 260) + ")";
    }
    setRing(0);
    function frame() {
      if (done) return;
      if (holding) fillPct = Math.min(100, fillPct + 1.9);
      else fillPct = Math.max(0, fillPct - 1.1);
      setRing(fillPct);
      if (fillPct >= 100) { complete(); return; }
      awakenRaf = requestAnimationFrame(frame);
    }
    function complete() {
      done = true; cancelAnimationFrame(awakenRaf);
      holding = false; btn.hidden = true; sGold();
      var d = run.log[0];
      res.hidden = false;
      res.innerHTML = '<div class="big">' + run.root + '</div>先天资质 <b>' + run.apt + '</b>（' + D.APT_TITLES[run.apt] + '）<br>寿元 ' + run.lifeMax + ' 年 · 同代宿敌「' + run.rival.name + '」已觉醒';
      setTimeout(function () { mask.hidden = true; interacting = false; onDone(); }, 1700);
    }
    function down(e) { if (done) return; e.preventDefault(); holding = true; btn.classList.add("holding"); }
    function up() { holding = false; btn.classList.remove("holding"); }
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
    awakenRaf = requestAnimationFrame(frame);
  }

  /* ---------------- 抉择 ---------------- */
  function isBad(eff) {
    if (!eff) return false;
    var k = Object.keys(eff);
    for (var i = 0; i < k.length; i++) { var v = eff[k[i]]; if (Array.isArray(v) && v[1] < 0) return true; }
    return false;
  }
  function openChoice(ch) {
    interacting = true;
    $("choice-title").textContent = "🔮 " + ch.title;
    $("choice-text").textContent = ch.text;
    var opts = $("choice-opts"); opts.innerHTML = ""; opts.hidden = false;
    $("choice-result").hidden = true;
    ch.opts.forEach(function (o, idx) {
      var b = document.createElement("button");
      b.className = "choice-opt";
      b.innerHTML = '<span class="tag">' + (o.tag || "择") + '</span><span>' + o.label + "</span>";
      b.onclick = function () { pickChoice(ch, idx); };
      opts.appendChild(b);
    });
    $("choice-mask").hidden = false;
  }
  function pickChoice(ch, idx) {
    var r = Sim.resolveChoice(run, ch, idx);
    var bad = isBad(r.outcome.eff);
    $("choice-opts").hidden = true;
    var el = $("choice-result"); el.hidden = false;
    el.className = "choice-result" + (bad ? " bad" : "");
    el.innerHTML = "<b>" + r.opt.label + "</b><br>" + r.outcome.text + (r.applied || "");
    bad ? sDown() : sUp();
    var entry = { age: run.age, type: bad ? "down" : "good", text: "【" + ch.title + "·" + r.opt.label + "】" + r.outcome.text + (r.applied || "") };
    run.log.push(entry); appendLog(entry);
    renderAttrs();
    if (run.lifeMax <= run.age) { run.dead = true; run.cause = "抉择失利，道消身陨"; }
    setTimeout(function () {
      $("choice-mask").hidden = true; interacting = false;
      if (run.dead) finishRun(); else loop();
    }, 1500);
  }

  /* ---------------- 天降机缘 ---------------- */
  function openCatch(item) {
    interacting = true;
    var mask = $("catch-mask"); mask.hidden = false;
    $("catch-info").textContent = "「" + item.name + "」化作流光坠落——手快有，手慢无！";
    var res = $("catch-result"); res.hidden = true;
    var orb = $("catch-orb"); orb.hidden = false; orb.textContent = "🎁";
    var dur = 1.7, caught = false;
    orb.style.animation = "none"; void orb.offsetWidth;
    orb.style.animation = "orbFall " + dur + "s linear forwards";
    function finish(ok) {
      if (caught) return; caught = true;
      clearTimeout(catchTimer); orb.onclick = null;
      orb.style.animation = "none"; orb.hidden = true;
      res.hidden = false;
      var entry;
      if (ok) {
        var ap = Sim.catchItem(run, item);
        res.style.color = "var(--gold)";
        res.innerHTML = "接住了！「" + item.name + "」入手" + (ap || "");
        entry = { age: run.age, type: "catch", text: "接住天降「" + item.name + "」" + (ap || "") };
        sGold();
      } else {
        Sim.missCatch(run, item);
        res.style.color = "var(--red)";
        res.innerHTML = "手慢了…「" + item.name + "」消散于天地";
        entry = { age: run.age, type: "down", text: "错失天降「" + item.name + "」" };
        sDown();
      }
      run.log.push(entry); appendLog(entry); renderAttrs();
      setTimeout(function () { mask.hidden = true; interacting = false; loop(); }, 1000);
    }
    orb.onclick = function () { finish(true); };
    catchTimer = setTimeout(function () { finish(false); }, dur * 1000);
  }

  /* ---------------- 渡劫拔河 ---------------- */
  function openTrib() {
    interacting = true;
    var info = Sim.tribInfo(run);
    var prog = 0, t = info.time, ended = false;
    var mask = $("trib-mask"); mask.hidden = false;
    var res = $("trib-result"); res.hidden = true;
    var tap = $("btn-trib-tap"); tap.hidden = false;
    $("trib-info").textContent = run.xianyuan
      ? ("仙缘「" + run.xianyuan.name + "」护体，天劫侵蚀减半——顶住就能飞升！")
      : ("资质 " + run.apt + "，天劫每秒侵蚀 " + info.drain.toFixed(1) + "%——狂点抗劫，拉满即飞升！");
    var last = performance.now();
    function draw() {
      $("trib-fill").style.width = Math.max(0, Math.min(100, prog)) + "%";
      $("trib-pct").textContent = Math.max(0, Math.round(prog)) + "%";
      $("trib-timer").textContent = Math.max(0, t).toFixed(1) + "s";
    }
    draw();
    function end(win) {
      if (ended) return; ended = true;
      cancelAnimationFrame(tribRaf); tap.onpointerdown = null; tap.onclick = null;
      res.hidden = false; tap.hidden = true;
      if (win) {
        var a = Sim.ascendNow(run);
        run.finalCombat = a.combat; run.viaXianTai = a.viaXianTai;
        res.style.color = "var(--gold)";
        res.innerHTML = "🌈 " + a.text;
        sAscend();
        var e = { age: run.age, type: "ascend", text: a.text };
        run.log.push(e); appendLog(e);
      } else {
        var f = Sim.tribFail(run);
        res.style.color = "var(--red)";
        res.innerHTML = f.dead
          ? ("💥 天劫反噬！你未能撑过最后一刻，身陨道消…（寿元 -" + f.dmg + "）")
          : ("⚡ 天劫散去，你重伤跌坐，来年再战！（寿元 -" + f.dmg + "）");
        sDown();
        var e2 = { age: run.age, type: "down", text: "渡劫失败，天劫反噬，寿元 -" + f.dmg };
        run.log.push(e2); appendLog(e2);
      }
      renderAttrs();
      setTimeout(function () {
        mask.hidden = true; interacting = false;
        if (run.ascended || run.dead) finishRun(); else loop();
      }, win ? 2100 : 1500);
    }
    function tick(now) {
      if (ended) return;
      var dt = (now - last) / 1000; last = now;
      prog -= info.drain * dt; if (prog < 0) prog = 0;
      t -= dt; draw();
      if (prog >= 100) { end(true); return; }
      if (t <= 0) { end(false); return; }
      tribRaf = requestAnimationFrame(tick);
    }
    function onTap(e) { if (e) e.preventDefault(); prog = Math.min(100, prog + info.click); sTick(); draw(); }
    tap.addEventListener("pointerdown", onTap);
    tap.onclick = function () {}; /* 占位，pointerdown 已处理 */
    tribRaf = requestAnimationFrame(tick);
    /* 保存清理引用 */
    openTrib._cleanup = function () { cancelAnimationFrame(tribRaf); tap.removeEventListener("pointerdown", onTap); };
  }

  /* ---------------- 心魔来袭（狂点凝神） ---------------- */
  function openDemon() {
    interacting = true;
    var prog = 0, t = 3.0, drain = 22, click = 9, ended = false;
    var mask = $("demon-mask"); mask.hidden = false;
    var res = $("demon-result"); res.hidden = true;
    var tap = $("btn-demon-tap"); tap.hidden = false;
    var realm = Sim.realmOf(run.lvl);
    var loss = Math.max(4, Math.round(run.lifeMax * (0.05 + realm * 0.01)));
    var last = performance.now();
    function draw() {
      $("demon-fill").style.width = Math.max(0, Math.min(100, prog)) + "%";
    }
    draw();
    function end(win) {
      if (ended) return; ended = true;
      cancelAnimationFrame(demonRaf); tap.removeEventListener("pointerdown", onTap);
      res.hidden = false; tap.hidden = true;
      var entry;
      if (win) {
        var ap = Sim.applyEff(run, { xp: [30, 64], combat: [0.06, 0.14] });
        res.style.color = "var(--green)";
        res.innerHTML = "🧘 道心重归清明，因祸得福" + (ap || "");
        entry = { age: run.age, type: "good", text: "斩灭心魔，道心通透" + (ap || "") };
        sUp();
      } else {
        run.lifeMax -= loss;
        res.style.color = "var(--red)";
        res.innerHTML = "👿 心魔蚀体，气血翻涌（寿元 -" + loss + "）";
        entry = { age: run.age, type: "down", text: "心魔侵蚀，走火入魔，寿元 -" + loss };
        sDown();
      }
      run.log.push(entry); appendLog(entry); renderAttrs();
      if (run.lifeMax <= run.age) { run.dead = true; run.cause = "心魔噬体，走火而亡"; }
      setTimeout(function () {
        mask.hidden = true; interacting = false;
        if (run.dead) finishRun(); else loop();
      }, 1300);
    }
    function tick(now) {
      if (ended) return;
      var dt = (now - last) / 1000; last = now;
      prog -= drain * dt; if (prog < 0) prog = 0;
      t -= dt; draw();
      if (prog >= 100) { end(true); return; }
      if (t <= 0) { end(false); return; }
      demonRaf = requestAnimationFrame(tick);
    }
    function onTap(e) { if (e) e.preventDefault(); prog = Math.min(100, prog + click); sTick(); draw(); }
    tap.addEventListener("pointerdown", onTap);
    demonRaf = requestAnimationFrame(tick);
  }

  /* ---------------- 弹幕 ---------------- */
  function startDanmaku() {
    stopDanmaku();
    if (!save.danmaku) return;
    dmTimer = setInterval(spawnDanmaku, 1500);
  }
  function stopDanmaku() { if (dmTimer) { clearInterval(dmTimer); dmTimer = null; } }
  function spawnDanmaku() {
    if (!run || finished || interacting || paused) return;
    var layer = $("danmaku-layer"); if (!layer) return;
    var d = document.createElement("div"); d.className = "danmaku";
    d.textContent = D.DANMAKU[Math.floor(Math.random() * D.DANMAKU.length)];
    var h = layer.clientHeight || 260;
    d.style.top = (8 + Math.random() * (h - 30)) + "px";
    var dur = 5 + Math.random() * 3;
    d.style.animationDuration = dur + "s";
    layer.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, dur * 1000 + 300);
  }

  /* ---------------- 结算 ---------------- */
  function finishRun() {
    if (finished) return;
    finished = true;
    clearTimeout(timer); stopDanmaku();
    if (openTrib._cleanup) { openTrib._cleanup(); openTrib._cleanup = null; }
    if (run.dead) sDown();

    var baseCombat = Sim.combatOf(run);
    var finalCombat = run.ascended ? (run.finalCombat || Math.round(baseCombat * (run.xianyuan ? run.xianyuan.rate : 1))) : baseCombat;
    var exp = Sim.runExp(run);
    save.runs++;
    if (run.ascended) save.ascends++;
    if (run.xianyuan) { save.everXianyuan = true; recordXY(run.xianyuan.name); }
    if (dailyMode) { save.daily = { date: dateStr(), done: true }; }

    save.playerExp += exp;
    var leveledUp = false;
    while (save.playerExp >= D.expNeed(save.playerLv + 1)) {
      save.playerExp -= D.expNeed(save.playerLv + 1);
      save.playerLv++; leveledUp = true;
    }

    /* 排行榜 */
    save.board.push({
      name: run.root, root: run.root, apt: run.apt, lvl: run.lvl,
      realm: D.REALMS[Sim.realmOf(run.lvl)], combat: finalCombat, age: run.age,
      ascend: run.ascended, xy: run.xianyuan ? run.xianyuan.name : "", bot: false
    });
    save.board.sort(function (a, b) { return b.combat - a.combat; });
    save.board = save.board.slice(0, 60);

    /* 宿敌胜负 */
    var beatRival = (run.ascended && !run.rival.ascended) || run.lvl > run.rival.finalLvl;

    /* 成就判定 */
    var ctx = {
      lvl: run.lvl, age: run.age, apt: run.apt, combat: finalCombat,
      ascend: run.ascended, ascends: save.ascends, runs: save.runs,
      xianyuan: save.everXianyuan, comboBest: run.comboBest,
      beatRival: beatRival, dailyDone: !!(save.daily && save.daily.done),
      caught: run.caught
    };
    var newly = [];
    D.ACHIEVEMENTS.forEach(function (a) {
      if (!save.ach[a.id] && evalCond(a.cond, ctx)) { save.ach[a.id] = true; newly.push(a); }
    });
    persist();

    /* 结算界面 */
    $("settle-title").textContent = D.runTitle(run);
    $("settle-wuhun").innerHTML = "灵根：<b>" + run.root + "</b>　资质：" + run.apt + "（" + D.APT_TITLES[run.apt] + "）";
    $("settle-lvl").textContent = run.lvl + " 级（" + D.REALMS[Sim.realmOf(run.lvl)] + "）";
    $("settle-combat").textContent = Sim.fmtNum(finalCombat);
    $("settle-age").textContent = run.age + " 岁";
    $("settle-combo").textContent = run.comboBest + " 连破";
    $("settle-exp").textContent = "+" + exp;

    var god = $("settle-god");
    if (run.ascended) {
      god.hidden = false;
      god.innerHTML = "✨ 白日飞升！最终战力 <b>" + Sim.fmtNum(finalCombat) + "</b>" +
        (run.xianyuan ? "（仙缘增幅 ×" + run.xianyuan.rate + "）" : "");
    } else god.hidden = true;

    var xyEl = $("settle-xinwu");
    if (run.xianyuan) { xyEl.hidden = false; xyEl.textContent = "仙缘：" + run.xianyuan.name; } else xyEl.hidden = true;

    /* 宿敌结果 */
    var sr = $("settle-rival"); sr.hidden = false;
    if (beatRival) {
      sr.className = "settle-rival win";
      sr.innerHTML = "🏅 你压过了同代宿敌「" + run.rival.name + "」（他终 " + run.rival.finalLvl + " 级" + (run.rival.ascended ? "·飞升" : "") + "）";
    } else {
      sr.className = "settle-rival";
      sr.innerHTML = "😤 宿敌「" + run.rival.name + "」这一世胜过你（他终 " + run.rival.finalLvl + " 级" + (run.rival.ascended ? "·已飞升" : "") + "），来世再战！";
    }

    /* 挑战码结果（异步 PK） */
    var sc = $("settle-chal");
    if (chalMode && run.chalTarget > 0) {
      var win = finalCombat > run.chalTarget;
      if (win) save.chal.w++; else save.chal.l++;
      persist();
      sc.hidden = false;
      sc.className = "settle-chal " + (win ? "win" : "lose");
      sc.innerHTML = (win ? "🏆 挑战成功！" : "💀 挑战失败…") +
        " 你的战力 <b>" + Sim.fmtNum(finalCombat) + "</b> vs 对手 <b>" + Sim.fmtNum(run.chalTarget) + "</b>" +
        "（战绩 " + save.chal.w + " 胜 " + save.chal.l + " 负）";
    } else { sc.hidden = true; }

    /* 后悔钩子 */
    var rg = $("settle-regret");
    if (!run.ascended) {
      rg.hidden = false;
      if (run.lvl >= 99) rg.innerHTML = "😩 距飞升只差最后一步——你已至巅峰，却没能顶过天劫！";
      else rg.innerHTML = "📉 距半步真仙（99 级）还差 <b>" + (99 - run.lvl) + "</b> 级修为，下一世再拼一把！";
    } else rg.hidden = true;

    /* 错过的机缘 */
    var ms = $("settle-miss");
    if (run.misses && run.misses.length) {
      ms.hidden = false;
      ms.innerHTML = "💨 这一生你错过了 " + run.misses.length + " 次天降机缘：" + run.misses.map(function (m) { return m.name; }).join("、") + "（手再快些就好了）";
    } else if (run.caught > 0) {
      ms.hidden = false; ms.innerHTML = "🎁 这一生你接住了 " + run.caught + " 次天降机缘，手速惊人！";
    } else ms.hidden = true;

    var pos = -1;
    for (var i = 0; i < save.board.length; i++) {
      if (save.board[i].combat === finalCombat && save.board[i].age === run.age && !save.board[i].bot) { pos = i + 1; break; }
    }
    $("settle-rank").textContent = pos > 0 ? "🏆 仙榜战力第 " + pos + " 名（共 " + save.board.length + " 位修士）" : "";

    renderLegacyPick();
    show("view-settle");
    if (leveledUp) toast("🎉 玩家等级提升！当前 Lv." + save.playerLv + "（高阶灵根 +" + (save.playerLv * 0.1).toFixed(1) + "%）");
    newly.forEach(function (a, i) {
      setTimeout(function () { toast("⭐ 达成成就【" + a.name + "】 高阶灵根概率 +" + a.bonus + "%"); sGold(); }, 600 + i * 1700);
    });
  }

  /* 转世遗泽：三选一 */
  function renderLegacyPick() {
    var box = $("settle-legacy"), cards = $("legacy-cards");
    box.hidden = false; cards.innerHTML = "";
    var pool = D.LEGACIES.slice();
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    var picks = pool.slice(0, 3), chosen = false;
    picks.forEach(function (lg) {
      var c = document.createElement("button");
      c.className = "legacy-card";
      c.innerHTML = '<div class="lc-name">🕯 ' + lg.name + '</div><div class="lc-desc">' + lg.desc + "</div>";
      c.onclick = function () {
        if (chosen) return; chosen = true;
        Array.prototype.forEach.call(cards.querySelectorAll(".legacy-card"), function (x) { x.style.opacity = "0.4"; });
        c.classList.add("picked"); c.style.opacity = "1";
        var lgObj = {}; lgObj[lg.key] = true;
        save.legacy = lgObj; persist(); sGold();
        recordLG(lg.name);
        toast("🕯 已铭刻遗泽【" + lg.name + "】，将带入下一世");
      };
      cards.appendChild(c);
    });
  }

  function evalCond(cond, c) {
    try {
      var keys = Object.keys(c), vals = keys.map(function (k) { return c[k]; });
      return Function.apply(null, keys.concat(["return (" + cond + ");"])).apply(null, vals);
    } catch (e) { return false; }
  }

  /* ---------------- 炫耀战绩 ---------------- */
  function shareRun() {
    if (!run) return;
    var finalCombat = finalCombatOf(run);
    var beat = (run.ascended && !run.rival.ascended) || run.lvl > run.rival.finalLvl;
    var txt = "我在《修仙模拟器》觉醒「" + run.root + "」（资质 " + run.apt + "），修至 " + run.lvl + " 级·" +
      D.REALMS[Sim.realmOf(run.lvl)] + (run.ascended ? "，白日飞升！" : "。") +
      " 战力 " + Sim.fmtNum(finalCombat) + "，" + (beat ? "一世碾压宿敌「" + run.rival.name + "」！" : "惜败宿敌「" + run.rival.name + "」。") +
      " 你能成仙吗？";
    copyText(txt, "📣 战绩已复制，快去粘贴炫耀！");
  }

  /* ---------------- 生成挑战码 ---------------- */
  function genChallenge() {
    if (!run) return;
    var code = makeChalCode();
    var txt = "【修仙模拟器·挑战码】" + code + " —— 我这一世战力 " + Sim.fmtNum(finalCombatOf(run)) +
      "，用同一命格来比比谁更强！粘贴到「⚔ 挑战码」即可应战。";
    copyText(txt, "⚔ 挑战码已复制：" + code);
  }

  /* ---------------- 排行榜 ---------------- */
  var rankTab = "combat";
  function renderRank() {
    var list = save.board.slice().sort(function (a, b) {
      return rankTab === "combat" ? b.combat - a.combat : rankTab === "lvl" ? b.lvl - a.lvl : b.age - a.age;
    }).slice(0, 30);
    var tabs = [{ id: "combat", name: "⚔ 战力榜" }, { id: "lvl", name: "🧘 修为榜" }, { id: "age", name: "🕯 长寿榜" }];
    $("rank-board").innerHTML = tabs.map(function (t) {
      return '<button class="tab' + (t.id === rankTab ? " active" : "") + '" data-tab="' + t.id + '">' + t.name + "</button>";
    }).join("");
    $("rank-note").textContent = "榜单含各路修士（含宿敌与散修），保存在本机浏览器";
    var body = $("rank-body");
    if (!list.length) { body.innerHTML = '<div class="lb-tip">还没有记录，先去玩一局吧～</div>'; return; }
    body.innerHTML = list.map(function (b, i) {
      var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
      var label = (b.name || b.root) + (b.bot ? ' <span class="lb-god" style="color:#8fa2c4;border-color:#3a4a68">散修</span>' : "") + (b.ascend ? ' <b class="lb-god">仙</b>' : "");
      return '<div class="lb-row">' +
        '<span class="lb-pos">' + medal + "</span>" +
        '<span class="lb-name">' + label + "</span>" +
        '<span class="lb-realm">' + b.realm + "·" + b.lvl + "级</span>" +
        '<b class="lb-val">' + (rankTab === "combat" ? Sim.fmtNum(b.combat) : rankTab === "lvl" ? b.lvl + " 级" : b.age + " 岁") + "</b>" +
        "</div>";
    }).join("");
    Array.prototype.forEach.call($("rank-board").querySelectorAll(".tab"), function (btn) {
      btn.onclick = function () { rankTab = btn.getAttribute("data-tab"); renderRank(); };
    });
  }

  /* ---------------- 成就页 ---------------- */
  function renderAch() {
    $("ach-total").textContent = "成就加成：+" + achBonus().toFixed(1) + "%（提升高阶灵根抽取概率）";
    $("ach-list").innerHTML = D.ACHIEVEMENTS.map(function (a) {
      var got = !!save.ach[a.id];
      return '<div class="ach-card' + (got ? " got" : "") + '">' +
        '<div class="ach-name">' + (got ? "✅ " : "🔒 ") + a.name + "</div>" +
        '<div class="ach-desc">' + a.desc + "</div>" +
        '<div class="ach-bonus">+' + a.bonus + "%</div></div>";
    }).join("");
  }

  /* ---------------- 设置 ---------------- */
  var settingsReturn = "home";
  function bindSettings() {
    var sw = $("home-sound"); sw.checked = save.sound;
    sw.onchange = function () { save.sound = sw.checked; persist(); if (save.sound) sUp(); };
    var dm = $("home-danmaku"); dm.checked = save.danmaku;
    dm.onchange = function () { save.danmaku = dm.checked; persist(); if (run && !finished) { if (save.danmaku) startDanmaku(); else stopDanmaku(); } };
    var rg = $("speed-range"), sv = $("speed-val");
    rg.value = save.speed; sv.textContent = save.speed.toFixed(2) + "s";
    rg.oninput = function () { save.speed = parseFloat(rg.value); sv.textContent = save.speed.toFixed(2) + "s"; persist(); };
  }

  /* ---------------- 暂停 / 回顾 ---------------- */
  function openPause() {
    if (!run || finished || interacting) return;
    paused = true; clearTimeout(timer);
    $("pause-info").textContent = "当前：" + run.age + " 岁 · " + D.REALMS[Sim.realmOf(run.lvl)] + " " + run.lvl + " 级 · 战力 " + Sim.fmtNum(Sim.combatOf(run));
    $("pause-mask").hidden = false;
  }
  function openReview() {
    if (!run) return;
    $("review-log").innerHTML = run.log.map(function (l) {
      return '<div class="review-line"><span class="log-age">' + l.age + " 岁</span> " + l.text + "</div>";
    }).join("");
    $("review-mask").hidden = false;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $("btn-start").onclick = function () { startGame("normal"); };
    $("btn-daily").onclick = function () { startGame("daily"); };
    $("btn-rank").onclick = function () { renderRank(); show("view-rank"); };
    $("btn-ach").onclick = function () { renderAch(); show("view-ach"); };
    $("btn-codex").onclick = function () { renderCodex(); show("view-codex"); };
    $("btn-chal").onclick = function () { openChallenge(); };
    $("btn-chal-close").onclick = function () { $("challenge-mask").hidden = true; };
    $("btn-chal-go").onclick = function () {
      var code = parseChalCode($("chal-input").value);
      if (!code) { $("chal-record").innerHTML = '<span class="lose">挑战码格式有误</span>，应形如 AX3F9-128000'; return; }
      $("challenge-mask").hidden = true;
      startGame("challenge", code.seed, code.score);
    };
    $("btn-settings").onclick = function () { settingsReturn = "home"; bindSettings(); show("view-settings"); };
    $("btn-about").onclick = function () { show("view-about"); };
    $("btn-close-rank").onclick = function () { show("view-home"); renderHome(); };
    $("btn-close-ach").onclick = function () { show("view-home"); renderHome(); };
    $("btn-close-codex").onclick = function () { show("view-home"); renderHome(); };
    $("btn-close-about").onclick = function () { show("view-home"); renderHome(); };
    $("btn-close-settings").onclick = function () {
      if (settingsReturn === "pause" && run && !finished) {
        show("view-game");
        $("pause-info").textContent = "当前：" + run.age + " 岁 · " + D.REALMS[Sim.realmOf(run.lvl)] + " " + run.lvl + " 级 · 战力 " + Sim.fmtNum(Sim.combatOf(run));
        $("pause-mask").hidden = false;
      } else { show("view-home"); renderHome(); }
      settingsReturn = "home";
    };

    $("btn-pause").onclick = openPause;
    $("btn-pause-resume").onclick = function () { $("pause-mask").hidden = true; paused = false; loop(); };
    $("btn-pause-settings").onclick = function () { settingsReturn = "pause"; bindSettings(); show("view-settings"); };
    $("btn-pause-settle").onclick = function () { $("pause-mask").hidden = true; finishEarly(); };
    $("btn-pause-exit").onclick = function () {
      $("pause-mask").hidden = true; finished = true; clearTimeout(timer); stopDanmaku();
      if (openTrib._cleanup) { openTrib._cleanup(); openTrib._cleanup = null; }
      run = null; show("view-home"); renderHome();
    };

    $("btn-settle-again").onclick = function () { renderHome(); startGame("normal"); };
    $("btn-settle-home").onclick = function () { renderHome(); show("view-home"); };
    $("btn-settle-review").onclick = openReview;
    $("btn-settle-share").onclick = shareRun;
    $("btn-settle-challenge").onclick = genChallenge;
    $("btn-review-close").onclick = function () { $("review-mask").hidden = true; };
  }

  function finishEarly() {
    run.dead = false; run.ascended = false;
    finished = false; finishRun();
  }

  /* ---------------- 调试钩子（?debug=1 时启用，便于测试 QTE） ---------------- */
  if (/[?&]debug=1/.test(location.search)) {
    window.__xx = {
      get run() { return run; },
      setLvl: function (v) { if (run) { run.lvl = v; renderAttrs(); } },
      trib: function () { if (run) { interacting = false; paused = false; clearTimeout(timer); openTrib(); } },
      demon: function () { if (run) { interacting = false; paused = false; clearTimeout(timer); openDemon(); } },
      catchIt: function () { if (run) { interacting = false; paused = false; clearTimeout(timer); openCatch(D.CATCH_ITEMS[0]); } }
    };
  }

  seedBoard();
  bind();
  renderHome();
  show("view-home");
})();
