/* ============================================================
 * 修仙模拟器 · 界面与主流程（原创实现）
 * 视图切换 / 年循环 / 本地存档 / 本地排行榜 / 成就 / 设置 / 音效
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
      if (s && typeof s === "object") return s;
    } catch (e) {}
    return {
      playerLv: 0, playerExp: 0,
      runs: 0, ascends: 0,
      ach: {},                       /* id -> true */
      board: [],                     /* 排行榜 */
      sound: true, speed: 0.1,
      everXianyuan: false
    };
  }
  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch (e) {} }

  function achBonus() {
    var b = 0;
    D.ACHIEVEMENTS.forEach(function (a) { if (save.ach[a.id]) b += a.bonus; });
    return b;
  }

  /* ---------------- 音效（WebAudio 简易提示音） ---------------- */
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
  function sAscend() { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, 0.25, "sine"); }, i * 120); }); }

  /* ---------------- 成就 toast ---------------- */
  var toastTimer = null;
  function toast(html) {
    var t = $("ach-toast");
    t.innerHTML = html; t.hidden = false; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.hidden = true; }, 300); }, 2600);
  }

  /* ---------------- 视图切换 ---------------- */
  var views = ["view-home", "view-game", "view-settle", "view-rank", "view-ach", "view-settings", "view-about"];
  function show(id) {
    views.forEach(function (v) { $(v).classList.toggle("active", v === id); });
    window.scrollTo(0, 0);
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    $("home-count").textContent = save.runs;
    $("home-ascend-count").textContent = save.ascends;
    var lv = save.playerLv, exp = save.playerExp, need = D.expNeed(lv + 1);
    $("home-lv").textContent = "[Lv." + lv + "]";
    $("home-lv-bonus").textContent = lv > 0 ? "（高阶灵根 +" + (lv * 0.1).toFixed(1) + "%）" : "";
    $("home-lv-exp").textContent = exp + "/" + need;
    $("home-lv-fill").style.width = Math.min(100, exp / need * 100) + "%";
    $("ach-tip").textContent = "成就增加高阶灵根概率：" + achBonus().toFixed(1) + "%";
  }

  /* ---------------- 游戏主循环 ---------------- */
  var run = null, timer = null, paused = false, finished = false;

  function startGame() {
    run = Sim.newRun(save.playerLv, achBonus());
    finished = false; paused = false;
    $("log-box").innerHTML = "";
    run.log.forEach(function (l) { appendLog(l); });
    renderAttrs();
    show("view-game");
    loop();
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

  function appendLog(entry) {
    var box = $("log-box");
    var div = document.createElement("div");
    div.className = "log-line log-" + (entry.type || "plain");
    var ageTag = document.createElement("span");
    ageTag.className = "log-age";
    ageTag.textContent = entry.age + " 岁";
    var txt = document.createElement("span");
    txt.textContent = entry.text;
    div.appendChild(ageTag); div.appendChild(txt);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function loop() {
    clearTimeout(timer);
    if (!run || finished || paused) return;
    timer = setTimeout(function () {
      var logs = Sim.stepYear(run);
      logs.forEach(function (l) {
        run.log.push(l);
        appendLog(l);
        if (l.type === "up") sUp(); else if (l.type === "realm") sRealm(); else if (l.type === "gold") sGold(); else if (l.type === "down") sDown(); else if (l.type === "ascend") sAscend();
      });
      renderAttrs();
      if (run.dead || run.ascended) { finishRun(); return; }
      loop();
    }, save.speed * 1000);
  }

  /* ---------------- 结算 ---------------- */
  function finishRun() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (run.dead) sDown();

    var combat = Sim.combatOf(run);
    var exp = Sim.runExp(run);
    save.runs++;
    if (run.ascended) save.ascends++;
    if (run.xianyuan) save.everXianyuan = true;

    /* 玩家经验 */
    save.playerExp += exp;
    var leveledUp = false;
    while (save.playerExp >= D.expNeed(save.playerLv + 1)) {
      save.playerExp -= D.expNeed(save.playerLv + 1);
      save.playerLv++; leveledUp = true;
    }

    /* 排行榜（本地，按战力取前 50） */
    save.board.push({
      root: run.root, apt: run.apt, lvl: run.lvl,
      realm: D.REALMS[Sim.realmOf(run.lvl)],
      combat: combat, age: run.age,
      ascend: run.ascended, xy: run.xianyuan ? run.xianyuan.name : ""
    });
    save.board.sort(function (a, b) { return b.combat - a.combat; });
    save.board = save.board.slice(0, 50);

    /* 成就判定 */
    var ctx = {
      lvl: run.lvl, age: run.age, apt: run.apt, combat: combat,
      ascend: run.ascended, ascends: save.ascends, runs: save.runs,
      xianyuan: save.everXianyuan
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
    $("settle-combat").textContent = Sim.fmtNum(combat);
    $("settle-age").textContent = run.age + " 岁";
    $("settle-exp").textContent = "+" + exp;
    var god = $("settle-god");
    if (run.ascended) {
      god.hidden = false;
      god.innerHTML = "✨ 飞升成仙！最终战力 <b>" + Sim.fmtNum(Math.round(combat * (run.xianyuan ? run.xianyuan.rate : 1))) + "</b>" +
        (run.xianyuan ? "（仙缘增幅 ×" + run.xianyuan.rate + "）" : "");
    } else god.hidden = true;
    var xyEl = $("settle-xinwu");
    if (run.xianyuan) { xyEl.hidden = false; xyEl.textContent = "仙缘：" + run.xianyuan.name; } else xyEl.hidden = true;
    var pos = -1;
    for (var i = 0; i < save.board.length; i++) {
      if (save.board[i].combat === combat && save.board[i].age === run.age) { pos = i + 1; break; }
    }
    $("settle-rank").textContent = pos > 0 ? "本地战力榜第 " + pos + " 名" : "";

    show("view-settle");
    if (leveledUp) toast("🎉 玩家等级提升！当前 Lv." + save.playerLv + "（高阶灵根 +" + (save.playerLv * 0.1).toFixed(1) + "%）");
    newly.forEach(function (a, i) {
      setTimeout(function () { toast("⭐ 达成成就【" + a.name + "】 高阶灵根概率 +" + a.bonus + "%"); sGold(); }, 600 + i * 1800);
    });
  }

  function evalCond(cond, c) {
    try {
      return Function("lvl", "age", "apt", "combat", "ascend", "ascends", "runs", "xianyuan",
        "return (" + cond + ");")(c.lvl, c.age, c.apt, c.combat, c.ascend, c.ascends, c.runs, c.xianyuan);
    } catch (e) { return false; }
  }

  /* ---------------- 排行榜（本地） ---------------- */
  var rankTab = "combat";
  function renderRank() {
    var list = save.board.slice().sort(function (a, b) {
      return rankTab === "combat" ? b.combat - a.combat : rankTab === "lvl" ? b.lvl - a.lvl : b.age - a.age;
    }).slice(0, 20);
    var tabs = [
      { id: "combat", name: "⚔ 战力榜" },
      { id: "lvl", name: "🧘 修为榜" },
      { id: "age", name: "🕯 长寿榜" }
    ];
    $("rank-board").innerHTML = tabs.map(function (t) {
      return '<button class="tab' + (t.id === rankTab ? " active" : "") + '" data-tab="' + t.id + '">' + t.name + "</button>";
    }).join("");
    $("rank-note").textContent = "榜单保存在本机浏览器中（前 50 局记录）";
    var body = $("rank-body");
    if (!list.length) { body.innerHTML = '<div class="lb-tip">还没有记录，先去玩一局吧～</div>'; return; }
    body.innerHTML = list.map(function (b, i) {
      var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
      return '<div class="lb-row">' +
        '<span class="lb-pos">' + medal + "</span>" +
        '<span class="lb-name">' + b.root + (b.ascend ? " <b class=\"lb-god\">仙</b>" : "") + "</span>" +
        '<span class="lb-realm">' + b.realm + "·" + b.lvl + "级</span>" +
        "<b class=\"lb-val\">" + (rankTab === "combat" ? Sim.fmtNum(b.combat) : rankTab === "lvl" ? b.lvl + " 级" : b.age + " 岁") + "</b>" +
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
  var settingsReturn = "home"; /* 从暂停进入设置时，关闭后回到暂停 */
  function bindSettings() {
    var sw = $("home-sound");
    sw.checked = save.sound;
    sw.onchange = function () { save.sound = sw.checked; persist(); if (save.sound) sUp(); };
    var rg = $("speed-range"), sv = $("speed-val");
    rg.value = save.speed; sv.textContent = save.speed.toFixed(1) + "s";
    rg.oninput = function () { save.speed = parseFloat(rg.value); sv.textContent = save.speed.toFixed(1) + "s"; persist(); };
  }

  /* ---------------- 暂停 / 回顾 ---------------- */
  function openPause() {
    if (!run || finished) return;
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
    $("btn-start").onclick = startGame;
    $("btn-rank").onclick = function () { renderRank(); show("view-rank"); };
    $("btn-ach").onclick = function () { renderAch(); show("view-ach"); };
    $("btn-settings").onclick = function () { settingsReturn = "home"; bindSettings(); show("view-settings"); };
    $("btn-about").onclick = function () { show("view-about"); };
    $("btn-close-rank").onclick = function () { show("view-home"); renderHome(); };
    $("btn-close-ach").onclick = function () { show("view-home"); renderHome(); };
    $("btn-close-about").onclick = function () { show("view-home"); renderHome(); };
    $("btn-close-settings").onclick = function () {
      if (settingsReturn === "pause" && run && !finished) {
        show("view-game");
        $("pause-info").textContent = "当前：" + run.age + " 岁 · " + D.REALMS[Sim.realmOf(run.lvl)] + " " + run.lvl + " 级 · 战力 " + Sim.fmtNum(Sim.combatOf(run));
        $("pause-mask").hidden = false;
      } else {
        show("view-home"); renderHome();
      }
      settingsReturn = "home";
    };

    $("btn-pause").onclick = openPause;
    $("btn-pause-resume").onclick = function () { $("pause-mask").hidden = true; paused = false; loop(); };
    $("btn-pause-settings").onclick = function () { settingsReturn = "pause"; bindSettings(); show("view-settings"); };
    $("btn-pause-settle").onclick = function () { $("pause-mask").hidden = true; run.dead = false; finishEarly(); };
    $("btn-pause-exit").onclick = function () {
      $("pause-mask").hidden = true; finished = true; clearTimeout(timer); run = null; show("view-home"); renderHome();
    };

    $("btn-settle-again").onclick = function () { renderHome(); startGame(); };
    $("btn-settle-home").onclick = function () { renderHome(); show("view-home"); };
    $("btn-settle-review").onclick = openReview;
    $("btn-review-close").onclick = function () { $("review-mask").hidden = true; };
  }

  function finishEarly() {
    /* 提前结算：不触发死亡文案 */
    run.dead = false; run.ascended = false;
    finished = false; finishRun();
  }

  bind();
  renderHome();
  show("view-home");
})();
