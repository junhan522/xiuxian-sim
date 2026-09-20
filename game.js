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
        if (!s.codex) s.codex = { roots: {}, xy: {}, lg: {}, tr: {}, eq: {} };
        if (!s.codex.roots) s.codex.roots = {};
        if (!s.codex.xy) s.codex.xy = {};
        if (!s.codex.lg) s.codex.lg = {};
        if (!s.codex.tr) s.codex.tr = {};
        if (!s.codex.eq) s.codex.eq = {};
        if (!s.streak) s.streak = { last: "", n: 0 };
        if (!s.chal) s.chal = { w: 0, l: 0 };
        if (!s.saga) s.saga = { dao: 0, grudge: 0, allies: 0, feuds: 0, slain: 0, lastBond: null, lastName: "" };
        if (typeof s.nickname !== "string") s.nickname = "";
        if (!s._debts || typeof s._debts !== "object") s._debts = {};
        if (!s.traitBook || typeof s.traitBook !== "object") s.traitBook = {};
        if (typeof s.nextTrait !== "string" || !s.nextTrait) s.nextTrait = null;
        if (!Array.isArray(s.carriedEquipment)) s.carriedEquipment = [];
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
      codex: { roots: {}, xy: {}, lg: {}, tr: {}, eq: {} },   /* 图鉴收集 */
      streak: { last: "", n: 0 },             /* 连续签到 */
      chal: { w: 0, l: 0 },                   /* 挑战码战绩 */
      saga: { dao: 0, grudge: 0, allies: 0, feuds: 0, slain: 0, lastBond: null, lastName: "" }, /* 恩怨录（累世） */
      nickname: "",                           /* 天下榜昵称 */
      _debts: {},                             /* 仇榜：曾败于某人 nickname -> 次数 */
      traitBook: {},                          /* 命格词条图鉴 */
      nextTrait: null,                        /* 下一世命格词条 id */
      carriedEquipment: []                    /* 下一世携带的法宝 id */
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

  /* ---------------- 庆祝 / 正反馈（非模态、可排队） ---------------- */
  var FX_COLORS = ["#f5c96b", "#ffd98a", "#b98aff", "#59d68c", "#5aa2ff", "#ff9b8a", "#ffffff"];
  function spawnConfetti(colors, count) {
    var layer = $("fx-layer"); if (!layer) return;
    colors = colors && colors.length ? colors : FX_COLORS;
    count = count || 46;
    var ring = document.createElement("div");
    ring.className = "fx-ring"; layer.appendChild(ring);
    setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 750);
    for (var i = 0; i < count; i++) {
      (function () {
        var p = document.createElement("div");
        p.className = "fx-confetti";
        var left = Math.random() * 100;
        var drift = (Math.random() * 160 - 80).toFixed(0) + "px";
        var spin = (Math.random() * 900 + 360).toFixed(0) + "deg";
        var dur = (Math.random() * 1.4 + 1.5).toFixed(2) + "s";
        var delay = (Math.random() * 0.35).toFixed(2) + "s";
        p.style.left = left + "vw";
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.setProperty("--drift", drift);
        p.style.setProperty("--spin", spin);
        p.style.animationDuration = dur;
        p.style.animationDelay = delay;
        if (Math.random() < 0.3) p.style.borderRadius = "50%";
        layer.appendChild(p);
        var life = (parseFloat(dur) + parseFloat(delay)) * 1000 + 200;
        setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, life);
      })();
    }
  }
  var celebQueue = [], celebBusy = false, celebTimer = null;
  function celebrate(opts) {
    if (!opts) return;
    celebQueue.push(opts);
    if (!celebBusy) nextCelebrate();
  }
  function nextCelebrate() {
    var box = $("celebrate");
    if (!box || !celebQueue.length) { celebBusy = false; return; }
    celebBusy = true;
    clearTimeout(celebTimer);
    var o = celebQueue.shift();
    $("celebrate-icon").textContent = o.icon || "✨";
    $("celebrate-title").textContent = o.title || "";
    $("celebrate-sub").innerHTML = o.sub || "";
    var prog = $("celebrate-prog");
    if (o.prog) { prog.hidden = false; $("celebrate-prog-txt").textContent = o.prog; }
    else prog.hidden = true;
    box.classList.remove("hide");
    box.hidden = false;
    try { sGold(); } catch (e) {}
    spawnConfetti(o.colors, o.count);
    var dur = o.dur || 2200;
    celebTimer = setTimeout(function () {
      box.classList.add("hide");
      setTimeout(function () { box.hidden = true; box.classList.remove("hide"); nextCelebrate(); }, 360);
    }, dur);
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
  function findTrait(id) {
    for (var i = 0; i < D.TRAITS.length; i++) if (D.TRAITS[i].id === id) return D.TRAITS[i];
    return null;
  }
  function findEquip(id) {
    for (var i = 0; i < D.EQUIPMENT.length; i++) if (D.EQUIPMENT[i].id === id) return D.EQUIPMENT[i];
    return null;
  }
  function ensureNextTrait() {
    if (save.nextTrait && findTrait(save.nextTrait)) return save.nextTrait;
    return rollNextTrait();
  }
  function rollNextTrait() {
    var pool = D.TRAITS.slice();
    if (save.nextTrait) {
      pool = pool.filter(function (t) { return t.id !== save.nextTrait; });
      if (!pool.length) pool = D.TRAITS.slice();
    }
    var tr = pool[Math.floor(Math.random() * pool.length)];
    save.nextTrait = tr.id;
    save.traitBook[tr.id] = (save.traitBook[tr.id] || 0) + 1;
    if (!save.codex.tr[tr.name]) save.codex.tr[tr.name] = true;
    persist();
    return tr.id;
  }
  function eqEffectText(eq) {
    var arr = [];
    if (eq.charm) arr.push("魅力 +" + eq.charm);
    if (eq.combatMul) arr.push("战力 ×" + eq.combatMul);
    if (eq.breakMul) arr.push("突破概率 ×" + eq.breakMul);
    if (eq.xpMul) arr.push("感悟 ×" + eq.xpMul);
    if (eq.eff) {
      var keys = Object.keys(eq.eff);
      for (var i = 0; i < keys.length; i++) {
        var v = eq.eff[keys[i]];
        var names = { life: "寿元", xp: "感悟", combat: "战力" };
        if (!names[keys[i]]) continue;
        arr.push(names[keys[i]] + (v[0] >= 0 ? " +" : " ") + v[0] + "~" + (v[1] >= 0 ? "+" : "") + v[1]);
      }
    }
    return arr.length ? arr.join(" · ") : "无额外效果";
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
    var nextTraitId = ensureNextTrait();
    var nextTrait = findTrait(nextTraitId);
    var ht = $("home-trait");
    if (nextTrait && ht) {
      ht.hidden = false;
      var icon = nextTrait.kind === "凶" ? "☠" : nextTrait.kind === "吉" ? "✨" : "☯";
      ht.innerHTML = '<span class="trait-kind ' + nextTrait.kind + '">' + icon + " " + nextTrait.kind + "</span>" +
        "下一世命格词条：<b>" + nextTrait.name + "</b>　" + nextTrait.desc;
    } else if (ht) ht.hidden = true;
    var carried = (save.carriedEquipment || []).map(function (id) { return findEquip(id); }).filter(Boolean);
    var he = $("home-equipment");
    if (carried.length && he) {
      he.hidden = false;
      he.innerHTML = "🎒 下一世携宝（" + carried.length + " 件）：" + carried.map(function (e) { return e.icon + " " + e.name; }).join("、");
    } else if (he) he.hidden = true;
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
    /* 恩怨录（累世宿敌羁绊） */
    var sg = save.saga || { dao: 0, grudge: 0, allies: 0, feuds: 0, slain: 0 };
    var saga = $("home-saga");
    if ((sg.allies || 0) + (sg.feuds || 0) > 0) {
      saga.hidden = false;
      saga.innerHTML = "🔗 恩怨录：<span class=\"saga-dao\">道谊 " + (sg.dao || 0) + "</span>" +
        "<span class=\"saga-sep\"> · </span><span class=\"saga-grudge\">宿怨 " + (sg.grudge || 0) + "</span>" +
        "<br>结交道友 <b>" + (sg.allies || 0) + "</b> 次 · 立下死敌 <b>" + (sg.feuds || 0) + "</b> 次 · 亲手斩落宿敌 <b>" + (sg.slain || 0) + "</b> 次" +
        "<br><span style=\"color:var(--sub);font-weight:400\">道谊增益来世寿元与资质，宿怨让你带着恨意起手更狠</span>";
    } else saga.hidden = true;
    /* 图鉴 / 挑战码按钮提示 */
    var cx = codexProgress();
    $("codex-tip").textContent = "已收集 " + cx.got + " / " + cx.total;
    $("chal-tip").textContent = save.chal.w + save.chal.l > 0
      ? ("挑战战绩 " + save.chal.w + " 胜 " + save.chal.l + " 负") : "同参一战，比拼战力";
    var fate = todayFate();
    var hf = $("home-fate");
    if (hf) {
      hf.hidden = false;
      hf.innerHTML = '<span class="fate-icon">' + fate.icon + '</span>' +
        '<span class="fate-name">今日天命 · ' + fate.name + '</span>' +
        '<span class="fate-desc">' + fate.desc + '</span>';
    }
    /* 仇榜：曾败于谁，去问鼎台复仇 */
    var debts = save._debts || {};
    var dnames = Object.keys(debts).sort(function (a, b) { return debts[b] - debts[a]; });
    var hg = $("home-grudge");
    if (hg) {
      if (dnames.length) {
        hg.hidden = false;
        var top = dnames.slice(0, 3).map(function (n) { return "「" + esc(n) + "」×" + debts[n]; }).join("、");
        hg.innerHTML = '<span class="grudge-icon">🗡</span>' +
          '<span class="grudge-txt">仇榜：你曾败于 ' + top + (dnames.length > 3 ? " 等" + dnames.length + " 人" : "") + '</span>' +
          '<button class="grudge-go" id="btn-grudge-go">去复仇</button>';
        var gb = $("btn-grudge-go");
        if (gb) gb.onclick = function () { rankMode = "net"; netTab = "combat"; renderRank(); show("view-rank"); };
      } else hg.hidden = true;
    }
    paintWorldFeed();
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
  function sagaAptBonus() { return Math.min(3, ((save.saga && save.saga.dao) || 0) * 0.12); }

  /* ---------------- 图鉴收集 ---------------- */
  function recordRoot(name) { if (!name) return false; var isNew = !save.codex.roots[name]; save.codex.roots[name] = (save.codex.roots[name] || 0) + 1; persist(); return isNew; }
  function recordXY(name) { if (!name) return false; var isNew = !save.codex.xy[name]; save.codex.xy[name] = (save.codex.xy[name] || 0) + 1; persist(); return isNew; }
  function recordLG(name) { if (!name) return false; var isNew = !save.codex.lg[name]; save.codex.lg[name] = true; persist(); return isNew; }
  function recordEquipment(name) { if (!name) return false; var isNew = !save.codex.eq[name]; save.codex.eq[name] = (save.codex.eq[name] || 0) + 1; persist(); return isNew; }
  function codexProgress() {
    var total = 0, got = 0, apt, i;
    for (apt = 1; apt <= 10; apt++) {
      var g = D.ROOTS[apt] || [];
      for (i = 0; i < g.length; i++) { total++; if (save.codex.roots[g[i]]) got++; }
    }
    for (i = 0; i < D.XIAN_YUAN.length; i++) { total++; if (save.codex.xy[D.XIAN_YUAN[i].name]) got++; }
    for (i = 0; i < D.LEGACIES.length; i++) { total++; if (save.codex.lg[D.LEGACIES[i].name]) got++; }
    for (i = 0; i < D.TRAITS.length; i++) { total++; if (save.codex.tr[D.TRAITS[i].name]) got++; }
    for (i = 0; i < D.EQUIPMENT.length; i++) { total++; if (save.codex.eq[D.EQUIPMENT[i].name]) got++; }
    return { got: got, total: total };
  }
  var codexTab = "root";
  function renderCodex() {
    var prog = codexProgress();
    $("codex-total").textContent = "收集进度：" + prog.got + " / " + prog.total;
    var tabs = [{ id: "root", name: "🌱 灵根" }, { id: "xy", name: "✨ 仙缘" }, { id: "lg", name: "🕯 遗泽" }, { id: "tr", name: "☯ 命格" }, { id: "eq", name: "🎒 法宝" }];
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
    } else if (codexTab === "lg") {
      html += '<div class="codex-group-title">转世遗泽（结算三选一，带入下一世）</div><div class="codex-grid">';
      for (i = 0; i < D.LEGACIES.length; i++) {
        var lg = D.LEGACIES[i], clg = !!save.codex.lg[lg.name];
        html += '<div class="codex-card' + (clg ? " got" : " locked") + '">' +
          '<div class="cx-name">' + lg.name + "</div>" +
          '<div class="cx-count">' + (clg ? lg.desc : "未铭刻") + "</div></div>";
      }
      html += "</div>";
    } else if (codexTab === "tr") {
      html += '<div class="codex-group-title">命格词条（每次转世获得一个新的）</div><div class="codex-grid">';
      for (i = 0; i < D.TRAITS.length; i++) {
        var tr = D.TRAITS[i], ctr = !!save.codex.tr[tr.name];
        html += '<div class="codex-card' + (ctr ? " got" : " locked") + '">' +
          '<div class="cx-name">' + (ctr ? tr.name : "？？？") + "</div>" +
          '<div class="cx-count">' + (ctr ? tr.desc : "未解锁") + "</div></div>";
      }
      html += "</div>";
    } else {
      html += '<div class="codex-group-title">法宝装备（修仙途中随机掉落，可带入下一世）</div><div class="codex-grid">';
      for (i = 0; i < D.EQUIPMENT.length; i++) {
        var eq = D.EQUIPMENT[i], ceq = save.codex.eq[eq.name] || 0;
        html += '<div class="codex-card' + (ceq ? " got" : " locked") + '">' +
          '<div class="cx-name">' + (ceq ? eq.icon + " " + eq.name : "？？？") + "</div>" +
          '<div class="cx-count">' + (ceq ? eq.rarity + " · " + eqEffectText(eq) : "未收集") + "</div></div>";
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
    run = Sim.newRun(save.playerLv, achBonus() + streakBonus() + sagaAptBonus(), {
      legacy: save.legacy || {},
      saga: save.saga,
      trait: ensureNextTrait(),
      equipment: save.carriedEquipment || []
    });
    run.seed = seed; run.chalTarget = chalTarget;
    run.rivalShown = 0; run.passedBots = {};
    /* 图鉴：记录本次觉醒的灵根 */
    run.newRoot = recordRoot(run.root);
    finished = false; paused = false; interacting = false;
    $("log-box").innerHTML = "";
    $("combo-badge").hidden = true;
    renderAttrs(); updateRivalBar();
    show("view-game");
    /* 觉醒仪式：长按蓄力后再揭晓灵根并开跑 */
    openAwaken(function () {
      appendLog(run.log[0]);
      startDanmaku();
      if (run.newRoot) {
        var cx = codexProgress();
        celebrate({
          icon: "🌱", title: "图鉴点亮 · " + run.root,
          sub: "首次觉醒此灵根，已录入仙途图鉴",
          prog: "图鉴收集 " + cx.got + " / " + cx.total,
          colors: ["#f5c96b", "#ffd98a", "#59d68c", "#ffffff"], count: 40, dur: 2400
        });
      }
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
    var charmEl = $("attr-charm");
    if (charmEl) charmEl.textContent = run.charm || 0;
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
        else if (l.type === "equip") pending = { kind: "equip", item: l.item };
      });
      showRivalMilestones();
      renderAttrs(); updateCombo(); checkSurpass();
      if (run.dead || run.ascended) { finishRun(); return; }
      if (pending && pending.kind === "choice") { openChoice(pending.choice); return; }
      if (pending && pending.kind === "catch") { openCatch(pending.item); return; }
      if (pending && pending.kind === "equip") { openEquip(pending.item); return; }
      if (run.tribYear) { openTrib(); return; }
      if (!run.bondChosen && Sim.realmOf(run.lvl) >= 2 && run.age - (run.lastInteractAge || 0) >= Sim.interactCd(run.lvl)) {
        run.lastInteractAge = run.age; openBond(); return;
      }
      if (Sim.realmOf(run.lvl) >= 2 && run.age - (run.lastInteractAge || 0) >= Sim.interactCd(run.lvl) && Sim.rnd() < 0.004) {
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
    var btn = $("btn-awaken"); btn.hidden = false; btn.textContent = qte("awaken", "btn", null, "按住蓄力");
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
      res.innerHTML = '<div class="big">' + run.root + '</div>' + qte("awaken", "result", {
        root: run.root, apt: run.apt, aptTitle: D.APT_TITLES[run.apt], life: run.lifeMax, rival: run.rival.name
      }, '先天资质 <b>' + run.apt + '</b>（' + D.APT_TITLES[run.apt] + '）<br>寿元 ' + run.lifeMax + ' 年 · 同代宿敌「' + run.rival.name + '」已觉醒') +
        (run.charm ? ' · 魅力 <b>' + run.charm + '</b>' : '') +
        (run.birthFlavor ? '<div class="birth-flavor">' + run.birthFlavor + '</div>' : '');
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
    $("catch-info").textContent = qte("catch", "info", { item: item.name }, "「" + item.name + "」化作流光坠落——手快有，手慢无！");
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
        res.innerHTML = qte("catch", "win", { item: item.name, ap: ap || "" }, "接住了！「" + item.name + "」入手" + (ap || ""));
        entry = { age: run.age, type: "catch", text: "接住天降「" + item.name + "」" + (ap || "") };
        sGold();
      } else {
        Sim.missCatch(run, item);
        res.style.color = "var(--red)";
        res.innerHTML = qte("catch", "lose", { item: item.name }, "手慢了…「" + item.name + "」消散于天地");
        entry = { age: run.age, type: "down", text: "错失天降「" + item.name + "」" };
        sDown();
      }
      run.log.push(entry); appendLog(entry); renderAttrs();
      setTimeout(function () { mask.hidden = true; interacting = false; loop(); }, 1000);
    }
    orb.onclick = function () { finish(true); };
    catchTimer = setTimeout(function () { finish(false); }, dur * 1000);
  }

  /* ---------------- 法宝装备掉落 ---------------- */
  function openEquip(item) {
    interacting = true;
    var mask = $("equip-mask");
    if (!mask) { interacting = false; loop(); return; }
    mask.hidden = false;
    $("equip-name").innerHTML = item.icon + " " + item.name + '<span class="eq-rarity">' + item.rarity + "</span>";
    $("equip-desc").textContent = item.desc;
    $("equip-effect").textContent = eqEffectText(item);
    var btn = $("btn-equip-take");
    btn.disabled = false;
    btn.textContent = "收入囊中";
    btn.onclick = function () {
      btn.disabled = true;
      btn.textContent = "已收入";
      var got = Sim.collectEquipment(run, item);
      var isNew = recordEquipment(item.name);
      var entry = {
        age: run.age, type: "equip",
        text: got ? "拾取法宝「" + item.name + "」，收入囊中" : "已有同名法宝，这次只收取一缕灵光"
      };
      run.log.push(entry); appendLog(entry); sGold();
      if (got && isNew) {
        var cx = codexProgress();
        celebrate({
          icon: item.icon || "🎒", title: "法宝入册 · " + item.name,
          sub: item.desc + "<br>结算时可选入转世携带栏",
          prog: "图鉴收集 " + cx.got + " / " + cx.total,
          colors: ["#f5c96b", "#ffd98a", "#5aa2ff", "#ffffff"], count: 40, dur: 2200
        });
      }
      setTimeout(function () { mask.hidden = true; interacting = false; loop(); }, 500);
    };
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
      ? qte("trib", "infoXY", { xy: run.xianyuan.name }, "仙缘「" + run.xianyuan.name + "」护体，天劫侵蚀减半——顶住就能飞升！")
      : qte("trib", "info", { apt: run.apt, drain: info.drain.toFixed(1) }, "资质 " + run.apt + "，天劫每秒侵蚀 " + info.drain.toFixed(1) + "%——狂点抗劫，拉满即飞升！");
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
    function onTap(e) { if (e) e.preventDefault(); prog = Math.min(100, prog + info.click); sTick(); draw(); if (prog >= 100) { end(true); } }
    tap.addEventListener("pointerdown", onTap);
    tap.onclick = function () {}; /* 占位，pointerdown 已处理 */
    tribRaf = requestAnimationFrame(tick);
    /* 保存清理引用 */
    openTrib._cleanup = function () { cancelAnimationFrame(tribRaf); tap.removeEventListener("pointerdown", onTap); };
  }

  /* ---------------- 心魔来袭（狂点凝神） ---------------- */
  function openDemon() {
    interacting = true;
    var prog = 0, t = 4.5, drain = 9, click = 13, ended = false;
    var mask = $("demon-mask"); mask.hidden = false;
    var res = $("demon-result"); res.hidden = true;
    var tap = $("btn-demon-tap"); tap.hidden = false;
    var realm = Sim.realmOf(run.lvl);
    var loss = Math.max(2, Math.round(run.lifeMax * (0.02 + realm * 0.004)));
    var dInfo = $("demon-info");
    if (dInfo) dInfo.textContent = qte("demon", "info", null, "道心蒙尘！狂点凝神，驱散心魔！");
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
        var ap = Sim.applyEff(run, { xp: [55, 120], combat: [0.1, 0.24], life: [8, 20] });
        res.style.color = "var(--green)";
        res.innerHTML = qte("demon", "win", { ap: ap || "" }, "🧘 道心重归清明，因祸得福" + (ap || ""));
        entry = { age: run.age, type: "good", text: "斩灭心魔，道心通透" + (ap || "") };
        sUp();
      } else {
        run.lifeMax -= loss;
        res.style.color = "var(--red)";
        res.innerHTML = qte("demon", "lose", { loss: loss }, "👿 心魔蚀体，气血翻涌（寿元 -" + loss + "）");
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
    function onTap(e) { if (e) e.preventDefault(); prog = Math.min(100, prog + click); sTick(); draw(); if (prog >= 100) { end(true); } }
    tap.addEventListener("pointerdown", onTap);
    demonRaf = requestAnimationFrame(tick);
  }

  /* ---------------- 宿敌羁绊：结为道友 / 立为死敌 ---------------- */
  function openBond() {
    interacting = true;
    var mask = $("bond-mask"); mask.hidden = false;
    var res = $("bond-result"); res.hidden = true;
    var btns = { friend: $("bond-friend"), enemy: $("bond-enemy"), neutral: $("bond-neutral") };
    Object.keys(btns).forEach(function (k) { btns[k].classList.remove("dimmed"); btns[k].onclick = null; });
    var name = run.rival.name;
    var ahead = (run.foeLvl || 1) > run.lvl;
    $("bond-text").innerHTML = qte("bond", "intro", { name: name }, "狭路相逢！同代宿敌「<b>" + name + "</b>」拦在你面前，目光灼灼——是化敌为友，还是不死不休？");
    $("bond-stand").innerHTML = "当前修为：你 <b>" + run.lvl + "</b> 级　·　宿敌 <b>" + (run.foeLvl || 1) + "</b> 级" +
      (ahead ? "　（他暂时领先，你岂能甘心！）" : "　（你暂时领先，他虎视眈眈）");
    var chosen = false;
    function choose(kind) {
      if (chosen) return; chosen = true;
      run.bondChosen = true;
      run.bond = (kind === "neutral") ? null : kind;
      Object.keys(btns).forEach(function (k) { if (k !== kind) btns[k].classList.add("dimmed"); });
      var entry, color, head;
      if (kind === "friend") {
        var ap = Sim.applyEff(run, { xp: [8, 20] });
        color = "var(--green)";
        head = qte("bond", "friend", { name: name, ap: ap || "" }, "🤝 你与「" + name + "」义结金兰，自此论道同行、渡劫护道" + (ap || ""));
        entry = { age: run.age, type: "good", text: "与宿敌「" + name + "」结为道友，义结金兰" + (ap || "") };
      } else if (kind === "enemy") {
        var ac = Sim.applyEff(run, { combat: [0.03, 0.08] });
        color = "var(--red)";
        head = qte("bond", "enemy", { name: name, ac: ac || "" }, "⚔️ 你与「" + name + "」立下死誓，不死不休！被他压制反而激发你的凶性" + (ac || ""));
        entry = { age: run.age, type: "rival", text: "与宿敌「" + name + "」立为死敌，不死不休" + (ac || "") };
      } else {
        color = "var(--sub)";
        head = qte("bond", "neutral", { name: name }, "😐 你与「" + name + "」相视一笑，各修各道，两不相欠");
        entry = { age: run.age, type: "plain", text: "与宿敌「" + name + "」一笑泯恩仇，各修各道" };
      }
      res.hidden = false; res.style.color = color; res.textContent = head;
      run.log.push(entry); appendLog(entry); renderAttrs(); sGold();
      setTimeout(function () {
        mask.hidden = true; interacting = false;
        loop();
      }, 1400);
    }
    btns.friend.onclick = function () { choose("friend"); };
    btns.enemy.onclick = function () { choose("enemy"); };
    btns.neutral.onclick = function () { choose("neutral"); };
  }

  /* ---------------- 天下榜·问鼎挑战（拔河对决 QTE） ---------------- */
  /* idx: 0=榜首 1=榜眼 2=探花；名次越高对手反扑越凶 */
  var DUEL_CFG = [
    { t: 6.0, drain: 14, click: 10 },
    { t: 6.0, drain: 11, click: 10 },
    { t: 6.0, drain: 8, click: 10 }
  ];
  var DUEL_ACH = ["a_duel1", "a_duel2", "a_duel3"];
  var DUEL_WIN_LINES = [
    "🏆 挑战成功！你正面击溃了天下榜第{r}位「{f}」！",
    "🏆 酣畅淋漓！天下榜第{r}位「{f}」在你拳下跌落神坛！",
    "🏆 以弱胜强！你硬生生把第{r}位「{f}」从王座上拽了下来！"
  ];
  var DUEL_LOSE_LINES = [
    "💥 惜败（{w}）……第{r}位「{f}」依旧稳坐其上，再来！",
    "💥 功亏一篑（{w}）……「{f}」的第{r}位暂且保住了，下一世必取！",
    "💥 力竭而败（{w}）……第{r}位「{f}」冷笑：还不够格！"
  ];
  var DUEL_REVENGE_LINES = [
    "🗡 复仇成功！曾被「{f}」击败的耻辱，今日尽数奉还（第{r}位）！",
    "🗡 雪耻之战！你终于把「{f}」踩在脚下，宿怨了断，念头通达！",
    "🗡 一雪前耻！第{r}位「{f}」再不是你的对手，恩怨两清！"
  ];
  function duelLine(pool, idx, foeName, why) {
    return pick(pool).replace("{r}", idx + 1).replace("{f}", foeName).replace("{w}", why || "");
  }
  var duelRaf = null;
  function openDuel(idx, foe) {
    if (!foe) return;
    interacting = true;
    var cfg = DUEL_CFG[idx] || DUEL_CFG[2];
    var mask = $("duel-mask"); mask.hidden = false;
    var res = $("duel-result"); res.hidden = true; res.textContent = "";
    var tap = $("duel-tap"); tap.disabled = false; tap.textContent = "出 招";
    var medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
    var foeName = esc(foe.nickname || "无名散修");
    $("duel-title").innerHTML = medal + " 问鼎挑战 · 天下榜第" + (idx + 1) + "位";
    $("duel-foe").innerHTML = "对手：<b>" + foeName + "</b>（" + esc(foe.realm || "") + "·" + (foe.lvl || 0) + "级）　战力 <b>" + Sim.fmtNum(foe.combat || 0) + "</b>";
    $("duel-hint").textContent = "疯狂点击「出招」把战意条拉满即挑战成功！名次越高，对手反扑越凶。";
    var prog = 20, tLeft = cfg.t, over = false;
    function draw() {
      $("duel-fill").style.width = Math.max(0, Math.min(100, prog)) + "%";
      $("duel-time").textContent = Math.max(0, tLeft).toFixed(1) + "s";
      $("duel-prog-txt").textContent = Math.round(Math.max(0, Math.min(100, prog))) + "%";
    }
    var last = performance.now();
    function tick(now) {
      if (over) return;
      var dt = (now - last) / 1000; last = now;
      tLeft -= dt; prog -= cfg.drain * dt;
      if (prog <= 0) { prog = 0; draw(); end(false, "战意溃散"); return; }
      if (tLeft <= 0) { tLeft = 0; draw(); end(false, "力竭超时"); return; }
      draw();
      duelRaf = requestAnimationFrame(tick);
    }
    function onTap(e) {
      if (e) e.preventDefault();
      if (over) return;
      prog = Math.min(100, prog + cfg.click);
      draw();
      if (prog >= 100) end(true);
    }
    function end(win, why) {
      over = true; cancelAnimationFrame(duelRaf);
      tap.disabled = true;
      res.hidden = false;
      var foeNick = foe.nickname || "无名散修";
      var foeKey = (window.Net && Net.cleanNick) ? Net.cleanNick(foeNick) : foeNick;
      var myNick = (window.Net && Net.cleanNick) ? Net.cleanNick(save.nickname) : (save.nickname || "");
      if (!save._debts || typeof save._debts !== "object") save._debts = {};
      if (win) {
        var wasRevenge = (save._debts[foeKey] || 0) > 0;
        res.className = "trib-result duel-result win";
        sGold();
        spawnConfetti(["#f5c96b", "#ffd98a", "#ffffff", "#b98aff"], 70);
        unlockDuelAch(idx);
        if (wasRevenge) {
          delete save._debts[foeKey]; persist();
          res.innerHTML = duelLine(DUEL_REVENGE_LINES, idx, foeName, why);
          postFeed("revenge", foeNick, "");
          celebrate({
            icon: "🗡", title: "复仇雪耻！",
            sub: "你亲手击败了曾让你折戟的宿敌「" + foeName + "」<br>累世恩怨，今朝了断！",
            colors: ["#ff9b8a", "#f5c96b", "#ffffff", "#b98aff"], count: 90, dur: 2600
          });
        } else {
          res.innerHTML = duelLine(DUEL_WIN_LINES, idx, foeName, why);
          postFeed("plunder", foeNick, "");
        }
        /* 悬赏领赏：若天下频道有人悬赏追杀此人，你击败他即揭榜领赏 */
        var claimer = null;
        for (var i = 0; i < worldFeeds.length; i++) {
          var wf = worldFeeds[i];
          if (wf && wf.kind === "bounty" && (wf.target || "") === foeKey && (wf.actor || "") !== myNick) { claimer = wf; break; }
        }
        if (claimer) {
          postFeed("bounty_claim", foeNick, "");
          celebrate({
            icon: "💰", title: "揭榜领赏！",
            sub: claimer.actor + " 曾悬赏追杀「" + foeName + "」<br>你替天行道将其击败，赏金到手，扬名天下！",
            colors: ["#f5c96b", "#ffd98a", "#8fe6b0", "#ffffff"], count: 80, dur: 2600
          });
        }
      } else {
        save._debts[foeKey] = (save._debts[foeKey] || 0) + 1; persist();
        res.className = "trib-result duel-result lose";
        res.innerHTML = duelLine(DUEL_LOSE_LINES, idx, foeName, why) +
          '<br><span style="font-size:12px;color:#ff9b8a">🗡 此仇已记入仇榜，来日问鼎台再战必雪！</span>';
        sDown();
        postFeed("duel_lose", foeNick, "");
      }
      setTimeout(function () { mask.hidden = true; interacting = false; }, 1600);
    }
    tap.onpointerdown = onTap;
    tap.onclick = function () {};
    draw();
    duelRaf = requestAnimationFrame(tick);
  }
  function unlockDuelAch(idx) {
    var id = DUEL_ACH[idx], a = null;
    for (var i = 0; i < D.ACHIEVEMENTS.length; i++) if (D.ACHIEVEMENTS[i].id === id) a = D.ACHIEVEMENTS[i];
    if (!a || save.ach[id]) return;
    save.ach[id] = true; persist();
    celebrate({
      icon: "🏆", title: "隐藏成就解锁 · " + a.name,
      sub: a.desc + "<br>高阶灵根概率 +" + a.bonus + "%",
      colors: ["#f5c96b", "#ffd98a", "#ffffff", "#ff9b8a"], count: 90, dur: 2600
    });
    if ($("view-ach").classList.contains("active")) renderAch();
  }

  /* ---------------- 荣登前三·加冕（情绪拉满） ---------------- */
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  /* 文案变体工具：填充 {占位符} + 从 data.js QTE_LINES 随机取一条 */
  function fill(tpl, map) {
    return String(tpl == null ? "" : tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (map && map[k] != null) ? map[k] : m;
    });
  }
  function qte(group, key, map, fallback) {
    var g = (D && D.QTE_LINES && D.QTE_LINES[group]);
    var arr = g && g[key];
    if (arr && arr.length) return fill(pick(arr), map);
    return fallback != null ? fill(fallback, map) : "";
  }
  var CORONATE = {
    1: { icon: "👑", head: "天下第一！", line: [
      "万众俯首！你以凡躯踏碎天门，自今日起——<b>天下榜首刻汝名</b>！八方修士仰视你的战力，后来者皆以你为峰！",
      "王座易主？不，是<b>新皇登基</b>！全网修士抬头所见，皆是你高悬榜首的名字！这一世，你就是天！",
      "千军万马过独木桥，而你<b>踩着整座天下登了顶</b>！从今往后，『天下第一』四个字，姓你的姓！"
    ] },
    2: { icon: "🥈", head: "榜眼及第！", line: [
      "一人之下，万人之上！你距那座至高王座仅半步之遥，<b>全榜都记住了这个逼视榜首的名字</b>！",
      "银光加身！你与榜首之间只隔着一层窗户纸，<b>下一世捅破它，王座就是你的</b>！",
      "屈居榜眼？不，这是<b>蓄势待发</b>！整座天下都在等你掀翻榜首的那一刻！"
    ] },
    3: { icon: "🥉", head: "探花登榜！", line: [
      "鼎足而立！你硬生生杀入天下前三，<b>榜上金字从此有你一枚</b>，无数修士在你身后望尘莫及！",
      "三甲之列！你用一世修为凿穿了天梯，<b>把自己的名字钉在了天下第三</b>！",
      "探花及第，金榜题名！从此天下修士提起前三，<b>必念你的名字</b>！"
    ] }
  };
  function coronate(pos, nick) {
    var c = CORONATE[pos], box = $("coronate");
    if (!c || !box) return;
    coronateInfo = { pos: pos, nick: nick, combat: (run && run._finalCombat) || 0 };
    $("coronate-icon").textContent = c.icon;
    $("coronate-head").textContent = c.head;
    var lineTxt = Array.isArray(c.line) ? pick(c.line) : c.line;
    $("coronate-line").innerHTML = "「" + esc(nick) + "」荣登天下榜·第" + pos + "位！<br>" + lineTxt;
    box.hidden = false;
    box.classList.remove("go");
    void box.offsetWidth;
    box.classList.add("go");
    try { sAscend(); } catch (e) {}
    spawnConfetti(["#f5c96b", "#ffd98a", "#ffffff", "#b98aff", "#5aa2ff"], 130);
    setTimeout(function () { spawnConfetti(null, 80); }, 700);
    setTimeout(function () { spawnConfetti(null, 60); }, 1500);
    postFeed("coronate", "", "第" + pos + "位");
    var hide = function () { box.hidden = true; box.classList.remove("go"); box.onclick = null; };
    box.onclick = hide;
    clearTimeout(box._t);
    box._t = setTimeout(hide, 5200);
  }

  /* ---------------- 天下频道：跨玩家实时播报 ---------------- */
  var worldFeeds = [];   /* 最近拉取到的播报缓存 */
  var wfTimer = null;    /* 轮询计时器 */
  var FEED_TEXT = {
    coronate:  function (f) { return "👑 " + f.actor + " 荣登天下榜" + (f.extra || "前三") + "，万众俯首，八方来朝！"; },
    duel_win:  function (f) { return "⚔ " + f.actor + " 正面击溃榜上高手「" + (f.target || "无名") + "」，一战封神！"; },
    duel_lose: function (f) { return "💥 " + f.actor + " 挑战「" + (f.target || "无名") + "」惜败，跌坐尘埃，来日再战……"; },
    plunder:   function (f) { return "⚔ " + f.actor + " 于问鼎台洗劫「" + (f.target || "无名") + "」，夺其气运，威震天下！"; },
    revenge:   function (f) { return "🗡 复仇雪耻！" + f.actor + " 亲手击败宿敌「" + (f.target || "无名") + "」，一雪前耻！"; },
    ascend:    function (f) { return "🌈 " + f.actor + " 白日飞升，战力 " + (f.extra || "惊人") + "，名动天下！"; },
    shout:     function (f) { return "📢 " + f.actor + " 放话：" + (f.extra || "……"); },
    war_decl:  function (f) { return "🔥 檄文！" + f.actor + " 昭告天下，向「" + (f.target || "无名") + "」正式宣战：" + (f.extra || "不死不休！"); },
    bounty:    function (f) { return "💰 " + f.actor + " 悬赏追杀「" + (f.target || "无名") + "」：" + (f.extra || "击败者可领赏！"); },
    bounty_claim: function (f) { return "💰 " + f.actor + " 揭下悬赏，斩落「" + (f.target || "无名") + "」，领走赏金！"; },
    dethrone:  function (f) { return "⚡ 天变！" + f.actor + " 掀翻了「" + (f.target || "旧主") + "」，登顶天下榜！"; },
    upload:    function (f) { return "📣 " + f.actor + " 登榜天下，战力 " + (f.extra || "不凡") + "。"; }
  };
  function feedText(f) {
    var fn = FEED_TEXT[f && f.kind];
    return fn ? fn(f) : "🌍 " + ((f && f.actor) || "无名散修") + " 在天下留下了足迹。";
  }
  /* 发一条广播（尽力而为，失败静默，绝不影响游戏） */
  function broadcast(kind, actor, target, extra) {
    if (!window.Net || !Net.enabled()) return;
    try {
      var p = Net.postFeed(kind, actor, target, extra);
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function postFeed(kind, target, extra) {
    broadcast(kind, save.nickname || "无名散修", target, extra);
  }
  /* 榜首易主检测：#1 换人时全服播报（localStorage 去重，避免重复刷屏） */
  function checkDethrone(rows) {
    if (!rows || !rows.length) return;
    var top = rows[0];
    var nick = top.nickname || "无名散修";
    var key = nick + "|" + (top.combat || 0);
    var prev = save._top1 || "";
    if (!prev) { save._top1 = key; persist(); return; }
    if (prev === key) return;
    var prevNick = prev.split("|")[0];
    save._top1 = key; persist();
    if (prevNick && prevNick !== nick) {
      broadcast("dethrone", nick, prevNick, "");
      setTimeout(refreshWorldFeed, 800);
    }
  }
  function paintWorldFeed() {
    var box = $("world-feed"), list = $("world-feed-list");
    if (!box || !list) return;
    var netOn = window.Net && Net.enabled();
    if (!netOn) { box.hidden = true; return; }
    box.hidden = false;
    if (!worldFeeds.length) {
      list.innerHTML = '<div class="wf-line wf-empty">天下还很安静……点右上角「📢 放话」，做第一个喊话的人！</div>';
      return;
    }
    list.innerHTML = worldFeeds.slice(0, 5).map(function (f) {
      return '<div class="wf-line">' + feedText(f) + "</div>";
    }).join("");
  }
  function refreshWorldFeed() {
    if (!window.Net || !Net.enabled()) return;
    Net.feeds(12).then(function (rows) {
      worldFeeds = (rows && rows.length) ? rows : [];
      paintWorldFeed();
      checkTargeted(worldFeeds);
    }).catch(function () {});
  }
  /* 被点名检测：有人对我下檄文 / 发悬赏时弹提示（localStorage 去重，只提示新的） */
  function checkTargeted(rows) {
    if (!rows || !rows.length) return;
    var myNick = (window.Net && Net.cleanNick) ? Net.cleanNick(save.nickname) : (save.nickname || "");
    if (!myNick || myNick === "无名散修") return;
    var since = save._lastWarSeen || 0;
    if (!since) { save._lastWarSeen = Date.now(); persist(); return; } /* 首次只记基线，避免翻旧账 */
    var newest = since, hit = null, hitTs = 0;
    for (var i = 0; i < rows.length; i++) {
      var f = rows[i];
      if (!f || (f.kind !== "war_decl" && f.kind !== "bounty")) continue;
      if ((f.target || "") !== myNick || (f.actor || "") === myNick) continue;
      var ts = Date.parse(f.created_at) || 0;
      if (ts > since) { if (ts > newest) newest = ts; if (ts > hitTs) { hitTs = ts; hit = f; } }
    }
    if (newest > since) { save._lastWarSeen = newest; persist(); }
    if (hit) {
      var isWar = hit.kind === "war_decl";
      toast((isWar ? "🔥 「" + hit.actor + "」向你下檄文宣战：" : "💰 「" + hit.actor + "」对你发出悬赏令：") +
        (hit.extra || "……") + "　去天下榜应战！");
    }
  }
  /* ---------------- 发声（放话 / 檄文宣战 / 悬赏令，全服广播） ---------------- */
  var SHOUT_COOLDOWN = 30000;
  var SHOUT_MODES = {
    shout: {
      title: "📢 向全服放话", kind: "shout", target: false, btn: "放 话",
      info: "一句话，会出现在所有修士的首页「天下频道」和局内弹幕里。<br>文明放话，友善挑衅，30 秒一次。",
      ph: "例：榜一的，等我三世之后来取你王座！"
    },
    war: {
      title: "🔥 檄文宣战", kind: "war_decl", target: true, btn: "下 檄 文",
      info: "点名一位修士，向全天下宣告你要讨伐他！<br>檄文会挂在天下频道，群里也能看到你的战意。",
      ph: "例：三日之内，必取汝首级！"
    },
    bounty: {
      title: "💰 悬赏令", kind: "bounty", target: true, btn: "发 悬 赏",
      info: "给某位修士挂上悬赏！谁在问鼎台击败他，即可领赏扬名。<br>悬赏会长期挂在天下频道里，静候揭榜之人。",
      ph: "例：谁替我收拾他，我请喝奶茶！"
    }
  };
  var shoutMode = "shout";
  function setShoutMode(mode) {
    if (!SHOUT_MODES[mode]) mode = "shout";
    shoutMode = mode;
    var m = SHOUT_MODES[mode];
    var t = $("shout-title"); if (t) t.textContent = m.title;
    var info = $("shout-info"); if (info) info.innerHTML = m.info;
    var inp = $("shout-input"); if (inp) inp.placeholder = m.ph;
    var btn = $("btn-shout-send"); if (btn) btn.textContent = m.btn;
    var tg = $("shout-target"); if (tg) tg.hidden = !m.target;
    var err = $("shout-err"); if (err) err.textContent = "";
    var tabs = $("shout-tabs");
    if (tabs) Array.prototype.forEach.call(tabs.querySelectorAll(".shout-tab"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === mode);
    });
  }
  function openShout(mode) {
    var mask = $("shout-mask"); if (!mask) return;
    setShoutMode(mode || "shout");
    var inp = $("shout-input"); if (inp) inp.value = "";
    var tg = $("shout-target"); if (tg) tg.value = "";
    var err = $("shout-err"); if (err) err.textContent = "";
    mask.hidden = false;
    setTimeout(function () {
      var f = SHOUT_MODES[shoutMode].target ? $("shout-target") : $("shout-input");
      if (f) f.focus();
    }, 60);
  }
  function sendShout() {
    var m = SHOUT_MODES[shoutMode] || SHOUT_MODES.shout;
    var inp = $("shout-input"), err = $("shout-err"), tgEl = $("shout-target");
    var txt = ((inp && inp.value) || "").replace(/[<>]/g, "").trim().slice(0, 40);
    var target = ((tgEl && tgEl.value) || "").replace(/[<>]/g, "").trim().slice(0, 12);
    if (m.target) {
      if (!target) { if (err) err.textContent = "先填要点名的对手昵称！"; return; }
      var me = (window.Net && Net.cleanNick) ? Net.cleanNick(save.nickname) : (save.nickname || "");
      if (target === me) { if (err) err.textContent = "不能对自己下手啦！"; return; }
      if (!txt) txt = (m.kind === "war_decl") ? "不死不休，速来应战！" : "击败他，重重有赏！";
    } else if (!txt) {
      if (err) err.textContent = "先写一句狠话再放！";
      return;
    }
    var now = Date.now(), last = save._lastShout || 0;
    if (now - last < SHOUT_COOLDOWN) {
      if (err) err.textContent = "发声太频繁，" + Math.ceil((SHOUT_COOLDOWN - (now - last)) / 1000) + " 秒后再来";
      return;
    }
    save._lastShout = now; persist();
    postFeed(m.kind, m.target ? target : "", txt);
    var mask = $("shout-mask"); if (mask) mask.hidden = true;
    toast(m.kind === "shout" ? "📢 放话已发出，全服修士都能听到！"
        : m.kind === "war_decl" ? "🔥 檄文已昭告天下，「" + target + "」将收到你的战意！"
        : "💰 悬赏令已挂上天下频道，静候有人揭榜！");
    setTimeout(refreshWorldFeed, 800);
  }
  function startWorldFeed() {
    if (wfTimer) return;
    refreshWorldFeed();
    wfTimer = setInterval(refreshWorldFeed, 20000);
  }

  /* ---------------- 今日天命（每日全服同一卦象，日期种子） ---------------- */
  function fateOfDay(dateString) {
    var pool = (D && D.DAILY_FATE) || [];
    var fallback = { name: "平淡之日", icon: "🍵", mult: 1, desc: "无事发生，喝口茶慢慢修" };
    if (!pool.length) return fallback;
    var s = String(dateString || dateStr());
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return pool[h % pool.length] || fallback;
  }
  function todayFate() { return fateOfDay(dateStr()); }
  function fateMult() { var f = todayFate(); return (typeof f.mult === "number" && f.mult > 0) ? f.mult : 1; }

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
    if (worldFeeds.length && Math.random() < 0.35) {
      var wf = worldFeeds[Math.floor(Math.random() * worldFeeds.length)];
      d.textContent = feedText(wf);
      d.classList.add("wf-dm");
    } else {
      d.textContent = D.DANMAKU[Math.floor(Math.random() * D.DANMAKU.length)];
    }
    var h = layer.clientHeight || 260;
    d.style.top = (8 + Math.random() * (h - 30)) + "px";
    var dur = 5 + Math.random() * 3;
    d.style.animationDuration = dur + "s";
    layer.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, dur * 1000 + 300);
  }

  /* ---------------- 命格词条 / 转世携带装备展示 ---------------- */
  var MAX_CARRY = 3;
  function traitIcon(tr) {
    return tr.kind === "凶" ? "☠" : tr.kind === "吉" ? "✨" : "☯";
  }
  function renderNextTrait() {
    var box = $("settle-trait");
    if (!box) return;
    var tr = findTrait(save.nextTrait);
    if (!tr) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<span class="trait-kind ' + tr.kind + '">' + traitIcon(tr) + " " + tr.kind + "</span>" +
      "下一世命格词条：<b>" + tr.name + "</b><br>" + tr.desc;
  }
  function renderEquipmentPick() {
    var box = $("settle-equip"), cards = $("equip-cards");
    if (!box || !cards) return;
    var pool = ((run && run.equipment) || []).concat((run && run.birthEquipment) || []);
    var seen = {}, unique = [];
    pool.forEach(function (e) { if (e && !seen[e.id]) { seen[e.id] = true; unique.push(e); } });
    if (!unique.length) {
      box.hidden = false;
      cards.innerHTML = '<div class="equip-empty">这一世没有可带走的法宝，下一世空手入轮回。</div>';
      save.carriedEquipment = [];
      persist();
      return;
    }
    var initial = unique.slice(0, MAX_CARRY).map(function (e) { return e.id; });
    save.carriedEquipment = initial;
    persist();
    box.hidden = false;
    cards.innerHTML = "";
    unique.forEach(function (e) {
      var selected = initial.indexOf(e.id) >= 0;
      var c = document.createElement("button");
      c.type = "button";
      c.className = "equip-card" + (selected ? " picked" : "");
      c.innerHTML = '<div class="ec-top">' + e.icon + " " + e.name + '<span class="eq-rarity">' + e.rarity + "</span></div>" +
        '<div class="ec-desc">' + e.desc + "</div>" +
        '<div class="ec-effect">' + eqEffectText(e) + "</div>";
      c.onclick = function () {
        var idx = save.carriedEquipment.indexOf(e.id);
        if (idx >= 0) {
          save.carriedEquipment.splice(idx, 1);
          c.classList.remove("picked");
        } else {
          if (save.carriedEquipment.length >= MAX_CARRY) {
            toast("最多携带 " + MAX_CARRY + " 件法宝转世");
            return;
          }
          save.carriedEquipment.push(e.id);
          c.classList.add("picked");
        }
        persist(); sGold();
      };
      cards.appendChild(c);
    });
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

    /* 今日天命加成（全服当日同一卦象；挑战码局不参与，保证同码公平） */
    run.fate = todayFate();
    if (!chalMode && run.fate.mult && run.fate.mult !== 1) {
      finalCombat = Math.round(finalCombat * run.fate.mult);
    }

    /* 宿敌胜负 + 羁绊结算（死敌斩落 → 战力暴涨，需在入榜前生效） */
    var beatRival = (run.ascended && !run.rival.ascended) || run.lvl > run.rival.finalLvl;
    if (!save.saga) save.saga = { dao: 0, grudge: 0, allies: 0, feuds: 0, slain: 0, lastBond: null, lastName: "" };
    var bondLine = "", slewRival = false;
    if (run.bond === "enemy") {
      save.saga.feuds++;
      if (beatRival) {
        finalCombat = Math.round(finalCombat * 1.18);
        save.saga.slain++; save.saga.grudge += 2; slewRival = true;
        bondLine = "⚔ 你亲手斩落宿敌「" + run.rival.name + "」，一世宿怨就此了结，战力暴涨 ×1.18！（宿怨 +2）";
      } else {
        save.saga.grudge += 1;
        bondLine = "⚔ 死敌「" + run.rival.name + "」这一世终究压过你，宿怨未消（+1），来世带着恨意再战！";
      }
    } else if (run.bond === "friend") {
      save.saga.allies++; save.saga.dao += 2;
      bondLine = "🤝 与道友「" + run.rival.name + "」相守一世，道谊深厚（+2），来世福泽绵长、寿元更增。";
    }
    save.saga.lastBond = run.bond; save.saga.lastName = run.rival.name;

    var exp = Sim.runExp(run);
    save.runs++;
    if (run.ascended) save.ascends++;
    var newXY = false;
    if (run.xianyuan) { save.everXianyuan = true; newXY = recordXY(run.xianyuan.name); }
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

    /* 成就判定 */
    var ctx = {
      lvl: run.lvl, age: run.age, apt: run.apt, combat: finalCombat,
      ascend: run.ascended, ascends: save.ascends, runs: save.runs,
      xianyuan: save.everXianyuan, comboBest: run.comboBest,
      beatRival: beatRival, dailyDone: !!(save.daily && save.daily.done),
      caught: run.caught, bondFriend: run.bond === "friend", slewRival: slewRival
    };
    var newly = [];
    D.ACHIEVEMENTS.forEach(function (a) {
      if (!save.ach[a.id] && evalCond(a.cond, ctx)) { save.ach[a.id] = true; newly.push(a); }
    });
    persist();

    /* 结算界面 */
    $("settle-title").textContent = D.runTitle(run);
    $("settle-wuhun").innerHTML = "灵根：<b>" + run.root + "</b>　资质：" + run.apt + "（" + D.APT_TITLES[run.apt] + "）";
    var sf = $("settle-fate");
    if (sf) {
      if (run.fate && run.fate.mult && run.fate.mult !== 1) {
        sf.hidden = false;
        sf.innerHTML = run.fate.icon + " 今日天命·" + run.fate.name + "：战力 ×" + run.fate.mult + "（全服当日同卦）";
      } else { sf.hidden = true; sf.innerHTML = ""; }
    }
    $("settle-lvl").textContent = run.lvl + " 级（" + D.REALMS[Sim.realmOf(run.lvl)] + "）";
    $("settle-combat").textContent = Sim.fmtNum(finalCombat);
    $("settle-age").textContent = run.age + " 岁";
    $("settle-combo").textContent = run.comboBest + " 连破";
    $("settle-exp").textContent = "+" + exp;
    var dbtn = $("btn-settle-daily"); if (dbtn) dbtn.hidden = !dailyMode;

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

    /* 羁绊结果 */
    var sb = $("settle-bond");
    if (bondLine) {
      sb.hidden = false;
      sb.className = "settle-bond" + (run.bond === "friend" ? " friend" : run.bond === "enemy" ? " enemy" : "");
      sb.innerHTML = bondLine;
    } else { sb.hidden = true; }

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

    rollNextTrait();
    renderNextTrait();
    renderEquipmentPick();
    renderLegacyPick();
    show("view-settle");
    run._finalCombat = finalCombat;
    var sn = $("settle-nick"); if (sn) sn.value = save.nickname || "";
    var sns = $("settle-net-status");
    if (sns) {
      sns.className = "settle-net-status";
      sns.textContent = (window.Net && Net.enabled())
        ? "上传后可在全网天下榜留名（昵称可随时改）"
        : "联网榜未配置，暂无法上传（在 net.js 填入 Supabase 凭据开启）";
    }
    if (newXY) {
      var cxy = codexProgress();
      celebrate({
        icon: "✨", title: "仙缘入册 · " + run.xianyuan.name,
        sub: "首获此仙缘，增幅 ×" + run.xianyuan.rate + "，已录入图鉴",
        prog: "图鉴收集 " + cxy.got + " / " + cxy.total,
        colors: ["#b98aff", "#f5c96b", "#ffffff"], count: 50, dur: 2400
      });
    }
    if (leveledUp) {
      celebrate({
        icon: "🎉", title: "玩家等级提升 Lv." + save.playerLv,
        sub: "高阶灵根概率 +" + (save.playerLv * 0.1).toFixed(1) + "%，越肝越强！",
        colors: ["#f5c96b", "#ffd98a", "#5aa2ff", "#ffffff"], count: 50, dur: 2400
      });
    }
    newly.forEach(function (a) {
      celebrate({
        icon: "⭐", title: "达成成就 · " + a.name,
        sub: (a.desc || "") + "<br>高阶灵根概率 +" + a.bonus + "%",
        colors: ["#f5c96b", "#ffd98a", "#ffffff"], count: 44, dur: 2400
      });
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
        var newLG = recordLG(lg.name);
        if (newLG) {
          var clg = codexProgress();
          celebrate({
            icon: "🕯", title: "遗泽入册 · " + lg.name,
            sub: lg.desc + "<br>首次铭刻此遗泽，将带入下一世",
            prog: "图鉴收集 " + clg.got + " / " + clg.total,
            colors: ["#b98aff", "#f5c96b", "#ffffff"], count: 44, dur: 2400
          });
        } else {
          toast("🕯 已铭刻遗泽【" + lg.name + "】，将带入下一世");
        }
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
    var finalCombat = run._finalCombat || finalCombatOf(run);
    var beat = (run.ascended && !run.rival.ascended) || run.lvl > run.rival.finalLvl;
    var fate = run.fate || todayFate();
    var fateNote = (fate && fate.mult && fate.mult !== 1) ? "（今日天命·" + fate.name + " ×" + fate.mult + "）" : "";
    var hook = pick([
      " 你能成仙吗？",
      " 群里来战，敢不敢接？",
      " 不服？同一命格比比看！",
      " 我在天下榜等你抬头看我。",
      " 这把放群里能排第几？"
    ]);
    var txt = "我在《修仙模拟器》觉醒「" + run.root + "」（资质 " + run.apt + "），修至 " + run.lvl + " 级·" +
      D.REALMS[Sim.realmOf(run.lvl)] + (run.ascended ? "，白日飞升！" : "。") +
      " 战力 " + Sim.fmtNum(finalCombat) + fateNote + "，" +
      (beat ? "一世碾压宿敌「" + run.rival.name + "」！" : "惜败宿敌「" + run.rival.name + "」。") + hook;
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

  /* ---------------- 微信群文案：战书 / 昭告 / 同参战报 ---------------- */
  var coronateInfo = null; /* 最近一次加冕信息，供"昭告天下"复制 */
  function copyChallengeLetter(foe, idx) {
    if (!foe) return;
    var nick = save.nickname || "无名散修";
    var medal = idx === 0 ? "榜首" : idx === 1 ? "榜眼" : "探花";
    var txt = "【问鼎战书】" + nick + " 正式向天下榜第" + (idx + 1) + "位「" + (foe.nickname || "无名散修") +
      "」（" + medal + "）下战书！\n阁下战力 " + Sim.fmtNum(foe.combat || 0) +
      "，吾虽不才，三世之内必取汝王座！\n敢接吗？接了就来《修仙模拟器》天下榜应战！";
    copyText(txt, "📜 战书已复制，甩到群里去！");
  }
  function copyEdict() {
    var c = coronateInfo; if (!c) return;
    var flair = c.pos === 1 ? "自今日起天下榜首刻吾名，万众俯首！"
              : c.pos === 2 ? "一人之下万人之上，王座半步之遥！"
              : "鼎足而立，金榜留名！";
    var txt = "【加冕昭告】" + c.nick + " 于《修仙模拟器》荣登天下榜·第" + c.pos + "位！\n" +
      "战力 " + Sim.fmtNum(c.combat || 0) + "，" + flair + "\n群内诸修，不服来战！";
    copyText(txt, "📜 昭告已复制，昭告天下！");
  }
  function copyDailyReport() {
    if (!run) return;
    var code = makeChalCode();
    var txt = "【今日同参战报·" + dateStr() + "】我 " + (save.nickname || "无名散修") + " 觉醒「" + run.root + "」，修至 " +
      run.lvl + " 级·" + D.REALMS[Sim.realmOf(run.lvl)] + (run.ascended ? "，白日飞升！" : "。") +
      " 战力 " + Sim.fmtNum(run._finalCombat || finalCombatOf(run)) + "。\n今日天命·" + todayFate().name +
      "。\n同参道友来比！应战码：" + code;
    copyText(txt, "📜 同参战报已复制，发到群里比拼！");
  }
  /* 天下战报：把近期全服风云汇总成一段可粘贴到微信群的文案 */
  function copyWeekly() {
    var cnt = {};
    worldFeeds.forEach(function (f) { if (f && f.kind) cnt[f.kind] = (cnt[f.kind] || 0) + 1; });
    var n = function (k) { return cnt[k] || 0; };
    function build(top1) {
      var head = top1
        ? ("天下榜第一：「" + (top1.nickname || "无名散修") + "」战力 " + Sim.fmtNum(top1.combat || 0))
        : "天下榜虚位以待，谁来登顶？";
      var txt = "【天下战报·" + dateStr() + "】\n" + head + "\n" +
        "🔥 檄文宣战 " + n("war_decl") + " 起 · ⚔ 问鼎洗劫 " + (n("plunder") + n("duel_win")) + " 场 · 🗡 复仇雪耻 " + n("revenge") + " 次\n" +
        "💰 悬赏 " + n("bounty") + " 单 · 👑 加冕 " + n("coronate") + " 位 · 🌈 飞升 " + n("ascend") + " 人\n" +
        "群内刀光剑影、热闹不断——你也来《修仙模拟器》天下榜留个名，敢不敢？";
      copyText(txt, "📊 天下战报已复制，发到群里挑动风云！");
    }
    if (window.Net && Net.enabled()) {
      Net.top(1, "combat").then(function (rows) { build(rows && rows[0]); }).catch(function () { build(null); });
    } else build(null);
  }

  /* ---------------- 排行榜 ---------------- */
  var rankTab = "combat";
  var rankMode = (window.Net && Net.enabled()) ? "net" : "local";
  var netTab = "combat"; /* 天下榜当前维度：combat 战力 / apt 天资 / lvl 修为 / age 长寿 */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function bindRankMode() {
    var bl = $("rank-mode-local"), bn = $("rank-mode-net");
    if (bl) { bl.classList.toggle("active", rankMode === "local"); bl.onclick = function () { rankMode = "local"; renderRank(); }; }
    if (bn) { bn.classList.toggle("active", rankMode === "net"); bn.onclick = function () { rankMode = "net"; renderRank(); }; }
  }
  function renderRank() {
    bindRankMode();
    if (rankMode === "net") { renderNetRank(); return; }
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
  function renderNetRank() {
    var body = $("rank-body"), note = $("rank-note"), board = $("rank-board");
    if (!window.Net || !Net.enabled()) {
      board.innerHTML = "";
      note.textContent = "天下榜未开启";
      body.innerHTML = '<div class="lb-tip">联网天下榜尚未配置。<br>在 net.js 里填入你的 Supabase 项目 url 与 anonKey 后，' +
        '全网修士的战力就会汇聚到这里。</div>';
      return;
    }
    var NTABS = [
      { id: "combat", name: "⚔ 战力榜", note: "天下榜 · 全网修士实时战力（Supabase）" },
      { id: "apt",    name: "🌟 天资榜", note: "天资榜 · 按灵根资质高低排序" },
      { id: "lvl",    name: "🧘 修为榜", note: "修为榜 · 按境界等级高低排序" },
      { id: "age",    name: "🕯 长寿榜", note: "长寿榜 · 按享年寿元长短排序" }
    ];
    board.innerHTML = NTABS.map(function (t) {
      return '<button class="tab' + (t.id === netTab ? " active" : "") + '" data-ntab="' + t.id + '">' + t.name + "</button>";
    }).join("");
    Array.prototype.forEach.call(board.querySelectorAll(".tab"), function (btn) {
      btn.onclick = function () { netTab = btn.getAttribute("data-ntab"); renderNetRank(); };
    });
    var cur = netTab;
    note.textContent = (NTABS.filter(function (t) { return t.id === cur; })[0] || NTABS[0]).note;
    body.innerHTML = '<div class="lb-tip">正在从天下榜拉取战绩…</div>';
    Net.top(50, cur).then(function (rows) {
      if (cur !== netTab) return; /* 已切换维度，丢弃过期结果 */
      if (!rows || !rows.length) { body.innerHTML = '<div class="lb-tip">天下榜还没有人上榜，来做第一个！</div>'; return; }
      var myNick = Net.cleanNick(save.nickname);
      var combatMode = cur === "combat";
      if (combatMode) checkDethrone(rows);
      body.innerHTML = rows.map(function (b, i) {
        var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
        var label = esc(b.nickname || "无名散修") + " <span style=\"color:#8fa2c4\">·" + esc(b.root || "") + "</span>" +
          (b.ascend ? ' <b class="lb-god">仙</b>' : "") +
          (b.bond === "enemy" ? ' <span class="lb-god" style="color:#ff9b8a;border-color:#5a2b2b">敌</span>' :
           b.bond === "friend" ? ' <span class="lb-god" style="color:#8fe6b0;border-color:#2b5a3f">友</span>' : "");
        var isMe = (b.nickname || "无名散修") === myNick;
        var val = combatMode ? Sim.fmtNum(b.combat || 0)
                : cur === "apt" ? (b.apt || 0) + " 资质"
                : cur === "lvl" ? (b.lvl || 0) + " 级"
                : (b.age || 0) + " 岁";
        var topCls = (combatMode && i < 3) ? " top top" + (i + 1) : "";
        return '<div class="lb-row' + topCls + (isMe ? " me" : "") + '">' +
          '<span class="lb-pos">' + medal + "</span>" +
          '<span class="lb-name">' + label + "</span>" +
          '<span class="lb-realm">' + esc(b.realm || "") + "·" + (b.lvl || 0) + "级</span>" +
          '<b class="lb-val">' + val + "</b>" +
          ((combatMode && i < 3) ? '<button class="lb-duel" data-duel="' + i + '">⚔ 去挑战</button>' +
            '<button class="lb-letter" data-letter="' + i + '" title="复制问鼎战书，甩到群里">📜</button>' : "") +
          "</div>";
      }).join("");
      if (combatMode) {
        Array.prototype.forEach.call(body.querySelectorAll(".lb-duel"), function (btn) {
          btn.onclick = function () {
            var idx = parseInt(btn.getAttribute("data-duel"), 10);
            openDuel(idx, rows[idx]);
          };
        });
        Array.prototype.forEach.call(body.querySelectorAll(".lb-letter"), function (btn) {
          btn.onclick = function () {
            var idx = parseInt(btn.getAttribute("data-letter"), 10);
            copyChallengeLetter(rows[idx], idx);
          };
        });
      }
    }).catch(function (e) {
      if (cur !== netTab) return;
      body.innerHTML = '<div class="lb-tip">天下榜拉取失败：' + esc(e && e.message ? e.message : "网络错误") + "<br>请检查 net.js 配置或稍后再试。</div>";
    });
  }

  /* ---------------- 成就页 ---------------- */
  function renderAch() {
    $("ach-total").textContent = "成就加成：+" + achBonus().toFixed(1) + "%（提升高阶灵根抽取概率）";
    $("ach-list").innerHTML = D.ACHIEVEMENTS.map(function (a) {
      var got = !!save.ach[a.id];
      var masked = a.hidden && !got;
      var name = masked ? "？？？" : a.name;
      var desc = masked ? "隐藏成就 · 达成条件未知　（提示：去 🏆仙榜 → 🌐天下榜，看看前三名身后的按钮）" : a.desc;
      return '<div class="ach-card' + (got ? " got" : "") + (masked ? " masked" : "") + '">' +
        '<div class="ach-name">' + (got ? "✅ " : masked ? "🌫 " : "🔒 ") + name + "</div>" +
        '<div class="ach-desc">' + desc + "</div>" +
        '<div class="ach-bonus">+' + a.bonus + "%</div></div>";
    }).join("");
  }

  /* ---------------- 设置 ---------------- */
  var settingsReturn = "home";
  function bindSettings() {
    var ni = $("nick-input");
    if (ni) {
      ni.value = save.nickname || "";
      ni.oninput = function () { save.nickname = ni.value.replace(/[<>]/g, "").slice(0, 12); persist(); };
    }
    var ns = $("net-status");
    if (ns) {
      if (window.Net && Net.enabled()) { ns.textContent = "联网榜已连接：可上传战绩、查看天下榜"; ns.classList.add("on"); }
      else { ns.textContent = "联网榜未配置：在 net.js 填入 Supabase url 与 anonKey 后开启"; ns.classList.remove("on"); }
    }
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
    $("btn-shout").onclick = function () { openShout("shout"); };
    $("btn-shout-send").onclick = function () { sendShout(); };
    $("btn-shout-close").onclick = function () { $("shout-mask").hidden = true; };
    var stabs = $("shout-tabs");
    if (stabs) Array.prototype.forEach.call(stabs.querySelectorAll(".shout-tab"), function (b) {
      b.onclick = function () { setShoutMode(b.getAttribute("data-mode")); };
    });
    var wk = $("btn-weekly"); if (wk) wk.onclick = copyWeekly;
    var warQ = $("btn-war-quick"); if (warQ) warQ.onclick = function () { openShout("war"); };
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
    $("btn-settle-daily").onclick = copyDailyReport;
    $("btn-coronate-share").onclick = function (e) { e.stopPropagation(); copyEdict(); };
    var snk = $("settle-nick");
    if (snk) snk.oninput = function () { save.nickname = snk.value.replace(/[<>]/g, "").slice(0, 12); persist(); };
    var upBtn = $("btn-settle-upload");
    if (upBtn) upBtn.onclick = function () {
      var st = $("settle-net-status");
      if (!window.Net || !Net.enabled()) {
        if (st) { st.className = "settle-net-status err"; st.textContent = "联网榜未配置：请先在 net.js 填入 Supabase url 与 anonKey。"; }
        return;
      }
      if (!run) return;
      var nickEl = $("settle-nick");
      var nick = Net.cleanNick(nickEl ? nickEl.value : save.nickname);
      save.nickname = nick; persist();
      upBtn.disabled = true;
      if (st) { st.className = "settle-net-status"; st.textContent = "上传中…"; }
      var entry = {
        nickname: nick, root: run.root, apt: run.apt, lvl: run.lvl,
        realm: D.REALMS[Sim.realmOf(run.lvl)], combat: run._finalCombat || Sim.combatOf(run),
        age: run.age, ascend: !!run.ascended, bond: run.bond, seed: run.seed || ""
      };
      Net.submit(entry).then(function () {
        if (st) { st.className = "settle-net-status ok"; st.textContent = "已上榜！去 🏆仙榜 → 🌐天下榜 看看你的排名"; }
        sGold(); upBtn.disabled = false;
        postFeed(entry.ascend ? "ascend" : "upload", "", Sim.fmtNum(entry.combat));
        refreshWorldFeed();
        var myCombat = entry.combat;
        Net.top(50).then(function (rows) {
          for (var i = 0; i < rows.length && i < 3; i++) {
            if ((rows[i].nickname || "") === nick && Math.abs((rows[i].combat || 0) - myCombat) < 0.5) {
              coronate(i + 1, nick);
              if (st) st.textContent = "👑 荣登天下榜第" + (i + 1) + "位！全网修士都在仰望你！";
              break;
            }
          }
        }).catch(function () {});
      }).catch(function (e) {
        if (st) { st.className = "settle-net-status err"; st.textContent = "上传失败：" + (e && e.message ? e.message : "网络错误"); }
        upBtn.disabled = false;
      });
    };
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
      bond: function () { if (run) { interacting = false; paused = false; clearTimeout(timer); openBond(); } },
      catchIt: function () { if (run) { interacting = false; paused = false; clearTimeout(timer); openCatch(D.CATCH_ITEMS[0]); } },
      duel: function (i) { interacting = false; paused = false; clearTimeout(timer); openDuel(i || 0, { nickname: "测试榜首", realm: "真仙", lvl: 99, combat: 9999999 }); },
      coronate: function (p) { coronate(p || 1, save.nickname || "测试道友"); },
      feed: function (k, t, x) { postFeed(k || "upload", t || "", x || ""); setTimeout(refreshWorldFeed, 800); },
      wf: function () { refreshWorldFeed(); }
    };
  }

  seedBoard();
  bind();
  renderHome();
  startWorldFeed();
  show("view-home");
})();
