/* ============================================================
 * 修仙模拟器 · 模拟引擎（纯逻辑，无 DOM 依赖）
 * 觉醒灵根 → 逐年修炼 → 突破 / 随机事件 → 99 级渡劫或引仙台飞升
 * ============================================================ */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports)
    module.exports = factory(require("./data.js"));
  else root.Sim = factory(root.DATA);
})(typeof self !== "undefined" ? self : this, function (D) {

  function rand(a, b) { return a + Math.random() * (b - a); }
  function irand(a, b) { return Math.floor(rand(a, b + 1)); }

  /* ---------- 抽取灵根：先按权重抽先天资质，再在组内随机取名 ----------
   * 玩家等级加成与成就加成：提升高阶（资质 6-10）整体概率，
   * 增量在高阶内部按原权重比例分配 */
  function drawRoot(playerLv, achBonus) {
    var lv = Math.max(0, playerLv || 0);
    var base = D.INNATE_WEIGHTS;
    var s15 = 0, s610 = 0, i;
    for (i = 1; i <= 5; i++) s15 += base[i];
    for (i = 6; i <= 10; i++) s610 += base[i];
    var pOld = s610 / (s15 + s610);
    var pNew = Math.min(0.6, pOld + lv * 0.001 + (achBonus || 0) / 100);
    var x610 = (s15 * pNew) / (1 - pNew);
    var w = base.slice();
    for (i = 6; i <= 10; i++) w[i] = base[i] * (x610 / s610);
    var total = 0;
    for (i = 1; i <= 10; i++) total += w[i];
    var r = Math.random() * total, acc = 0, apt = 1;
    for (i = 1; i <= 10; i++) { acc += w[i]; if (r < acc) { apt = i; break; } }
    var group = D.ROOTS[apt];
    return { apt: apt, root: group[Math.floor(Math.random() * group.length)] };
  }

  /* 突破概率：查表（百分比 → 小数） */
  function breakChance(apt, lvl) {
    var seg;
    if (lvl >= 99) seg = 10;
    else if (lvl >= 91) seg = 9;
    else seg = Math.floor((lvl - 1) / 10);
    return D.BREAK_CHANCE[apt - 1][seg] / 100;
  }

  /* 战力 = 系数 × 等级^2.4 + 额外战力 */
  function combatOf(s) {
    return Math.round(D.COMBAT_COEF[s.apt] * Math.pow(s.lvl, 2.4) + s.combatExtra);
  }

  function realmOf(lvl) { return Math.min(9, Math.floor((lvl - 1) / 10)); }

  /* 境界内层数描述 */
  function stageName(lvl) {
    if (lvl >= 99) return "巅峰";
    var inRealm = ((lvl - 1) % 10) + 1;
    return inRealm + " 层";
  }

  /* ---------- 开局 ---------- */
  function newRun(playerLv, achBonus) {
    var d = drawRoot(playerLv, achBonus);
    /* 基础寿元：资质越高下限越高 */
    var baseLife = irand(40 + d.apt * 5, 60 + d.apt * 7);
    var s = {
      apt: d.apt, root: d.root,
      lvl: 1, age: 6,
      lifeMax: baseLife,
      combatExtra: 0,
      cultBonus: 0,       /* 修炼感悟（额外突破概率，百分点，逐年衰减） */
      xianyuan: null,     /* 仙缘 */
      ascended: false,
      dead: false,
      cause: "",
      log: [{ age: 6, text: "觉醒「" + d.root + "」，先天资质 " + d.apt + "（" + D.APT_TITLES[d.apt] + "），寿元 " + baseLife + " 年", type: "awake" }]
    };
    return s;
  }

  /* ---------- 单年推进：返回当年日志条目数组 ---------- */
  function stepYear(s) {
    var logs = [];
    s.age++;

    /* 寿终 */
    if (s.age > s.lifeMax) {
      s.dead = true;
      s.cause = "寿元耗尽，坐化于洞府之中";
      return logs;
    }

    /* 99 级：渡劫 / 引仙台 */
    if (s.lvl >= 99) {
      logs.push.apply(logs, tryAscend(s));
      return logs;
    }

    /* 90 级后：每年概率获得仙缘（最多 1 种） */
    if (!s.xianyuan && s.lvl >= 90 && Math.random() < D.XIAN_YUAN_CHANCE) {
      var xy = D.XIAN_YUAN[Math.floor(Math.random() * D.XIAN_YUAN.length)];
      s.xianyuan = xy;
      logs.push({ age: s.age, text: "天降异象！获得仙缘「" + xy.name + "」（渡劫时战力达 " + fmtNum(xy.needCombat) + " 可走引仙台）", type: "gold" });
    }

    /* 随机事件 */
    var ev = pickEvent(s.lvl);
    if (ev) {
      var applied = applyEvent(s, ev);
      logs.push({ age: s.age, text: ev.text + applied, type: evType(ev) });
    }

    /* 突破判定：感悟按比例加成（乘算，避免后期必成）；概率 >30% 时允许连破（每次概率减半，最多 3 次） */
    var broke = 0;
    var p = breakChance(s.apt, s.lvl) * (1 + s.cultBonus / 100);
    while (s.lvl < 99 && p > 0 && broke < 3) {
      if (Math.random() < p) {
        var oldRealm = realmOf(s.lvl);
        s.lvl++;
        broke++;
        var newRealm = realmOf(s.lvl);
        if (newRealm > oldRealm) {
          s.lifeMax += D.REALM_LIFE[newRealm];
          logs.push({ age: s.age, text: "突破大境界！晋升【" + D.REALMS[newRealm] + "】，寿元大增（+" + D.REALM_LIFE[newRealm] + "）", type: "realm" });
          if (s.lvl === 99) {
            logs.push({ age: s.age, text: "已至半步真仙之巅，此后每年可尝试渡劫飞升！", type: "gold" });
          }
        } else {
          logs.push({ age: s.age, text: "修为突破，晋升" + D.REALMS[newRealm] + " " + stageName(s.lvl), type: "up" });
        }
        if (p <= 0.3) break;
        p = p / 2;
      } else break;
    }

    /* 感悟衰减 */
    s.cultBonus = Math.max(0, s.cultBonus * 0.4);
    return logs;
  }

  /* ---------- 渡劫 ---------- */
  function tryAscend(s) {
    var logs = [];
    var combat = combatOf(s);
    var useXianTai = s.xianyuan && combat >= s.xianyuan.needCombat;
    var p;
    if (useXianTai) {
      p = D.XIAN_TAI_CHANCE;
      logs.push({ age: s.age, text: "以仙缘「" + s.xianyuan.name + "」叩开引仙台，接受接引考验……", type: "gold" });
    } else {
      p = D.TRIB_BASE[s.apt] / 100;
      logs.push({ age: s.age, text: "引动九天雷劫，硬渡天劫！成功率约 " + (p * 100).toFixed(1) + "%……", type: "trib" });
    }
    if (Math.random() < p) {
      s.ascended = true;
      logs.push({ age: s.age, text: "霞光万丈，仙乐齐鸣——渡劫成功，白日飞升！", type: "ascend" });
    } else if (useXianTai) {
      logs.push({ age: s.age, text: "引仙台考验未能通过，仙缘尚在，来年再试", type: "down" });
    } else if (Math.random() < D.TRIB_BACKLASH) {
      var dmg = Math.round(s.lifeMax * rand(0.08, 0.18));
      s.lifeMax -= dmg;
      logs.push({ age: s.age, text: "天劫反噬！重伤未愈，寿元 -" + dmg, type: "down" });
    } else {
      logs.push({ age: s.age, text: "天劫散去，虽未功成，道心愈坚", type: "down" });
    }
    return logs;
  }

  /* ---------- 事件 ---------- */
  function pickEvent(lvl) {
    var pool = D.EVENTS.filter(function (e) { return lvl >= e.min && lvl <= e.max; });
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i].w;
    var r = Math.random() * total, acc = 0;
    for (i = 0; i < pool.length; i++) { acc += pool[i].w; if (r < acc) return pool[i]; }
    return null;
  }

  function evType(ev) {
    if (!ev.eff || !Object.keys(ev.eff).length) return "plain";
    var keys = Object.keys(ev.eff);
    for (var i = 0; i < keys.length; i++) {
      var v = ev.eff[keys[i]];
      if (Array.isArray(v) && v[1] < 0) return "down";
    }
    return "good";
  }

  function applyEvent(s, ev) {
    var eff = ev.eff || {};
    var parts = [];
    if (eff.xp) {
      var v = Math.round(rand(eff.xp[0], eff.xp[1]));
      if (v >= 0) { s.cultBonus += v; parts.push("（感悟 +" + v + "）"); }
      else { s.cultBonus = Math.max(0, s.cultBonus + v); parts.push("（感悟 " + v + "）"); }
    }
    if (eff.life) {
      var l = Math.round(rand(eff.life[0], eff.life[1]));
      s.lifeMax += l;
      parts.push(l >= 0 ? "（寿元 +" + l + "）" : "（寿元 " + l + "）");
    }
    if (eff.combat) {
      /* 战力加成按「等级基础战力」计算，避免滚雪球 */
      var base = D.COMBAT_COEF[s.apt] * Math.pow(s.lvl, 2.4);
      var c = Math.round(base * rand(eff.combat[0], eff.combat[1]));
      s.combatExtra += c;
      parts.push(c >= 0 ? "（战力 +" + fmtNum(c) + "）" : "（战力 " + fmtNum(c) + "）");
    }
    return parts.join("");
  }

  function fmtNum(n) {
    var neg = n < 0; n = Math.abs(n);
    var t = n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, "") + " 万" : String(n);
    return (neg ? "-" : "") + t;
  }

  /* ---------- 结算经验 ---------- */
  function runExp(r) {
    return Math.floor(r.lvl * 2 + (r.ascend ? 300 : 0) + combatOf(r) / 5000);
  }

  return {
    drawRoot: drawRoot, breakChance: breakChance, combatOf: combatOf,
    realmOf: realmOf, stageName: stageName,
    newRun: newRun, stepYear: stepYear, runExp: runExp, fmtNum: fmtNum
  };
});
