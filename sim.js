/* ============================================================
 * 修仙模拟器 · 模拟引擎 v2（纯逻辑，无 DOM 依赖）
 * 新增：可注入 RNG（每日同参）、同代宿敌并行模拟、连破 combo、
 *       渡劫拔河（技能化 QTE）、抉择事件、天降机缘、转世遗泽。
 * 事件已按境界分段，pickEvent 同时按等级段与当前境界过滤。
 * ============================================================ */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports)
    module.exports = factory(require("./data.js"));
  else root.Sim = factory(root.DATA);
})(typeof self !== "undefined" ? self : this, function (D) {

  /* ---------- 可注入随机源 ---------- */
  var rng = Math.random;
  function setRng(fn) { rng = (typeof fn === "function") ? fn : Math.random; }
  function rand(a, b) { return a + rng() * (b - a); }
  function irand(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 交互冷却：任意两次「弹窗交互」（抉择/机缘/心魔/炼丹）之间的最小岁数间隔，
   * 避免流年被频繁打断。随境界提升而拉长——高境界寿命动辄上千载，
   * 若用固定间隔会导致弹窗密集，故按境界缩放。 */
  var INTERACT_CD = 48;
  function interactCd(lvl) { return INTERACT_CD + realmOf(lvl) * 24; }

  /* 字符串 → 32bit 种子 */
  function hashStr(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  /* 确定性伪随机（每日种子用） */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 遗泽键位查询 ---------- */
  function has(legacy, key) { return !!(legacy && legacy[key]); }

  function traitById(id) {
    if (!id) return null;
    for (var i = 0; i < D.TRAITS.length; i++) if (D.TRAITS[i].id === id) return D.TRAITS[i];
    return null;
  }

  function equipmentById(id) {
    if (!id) return null;
    for (var i = 0; i < D.EQUIPMENT.length; i++) if (D.EQUIPMENT[i].id === id) return D.EQUIPMENT[i];
    return null;
  }

  /* ---------- 抽取灵根：先天资质按权重，再在组内取名 ----------
   * 玩家等级 / 成就 / 缘池遗泽：提升高阶（资质 6-10）整体概率 */
  function drawRoot(playerLv, achBonus, legacy) {
    var lv = Math.max(0, playerLv || 0);
    var base = D.INNATE_WEIGHTS.slice();
    var yuanLift = has(legacy, "yuanChi") ? 1.15 : 1;
    var i;
    for (i = 6; i <= 10; i++) base[i] = base[i] * yuanLift;
    var s15 = 0, s610 = 0;
    for (i = 1; i <= 5; i++) s15 += base[i];
    for (i = 6; i <= 10; i++) s610 += base[i];
    var pOld = s610 / (s15 + s610);
    var pNew = Math.min(0.6, pOld + lv * 0.001 + (achBonus || 0) / 100);
    var x610 = (s15 * pNew) / (1 - pNew);
    var w = base.slice();
    for (i = 6; i <= 10; i++) w[i] = base[i] * (x610 / s610);
    var total = 0;
    for (i = 1; i <= 10; i++) total += w[i];
    var r = rng() * total, acc = 0, apt = 1;
    for (i = 1; i <= 10; i++) { acc += w[i]; if (r < acc) { apt = i; break; } }
    var group = D.ROOTS[apt];
    return { apt: apt, root: group[Math.floor(rng() * group.length)] };
  }

  /* 突破概率：查表（百分比 → 小数） */
  function breakChance(apt, lvl) {
    var seg;
    if (lvl >= 99) seg = 10;
    else if (lvl >= 91) seg = 9;
    else seg = Math.floor((lvl - 1) / 10);
    return D.BREAK_CHANCE[apt - 1][seg] / 100;
  }

  /* 战力 = 系数 × 等级^2.4 + 额外战力（×仙骨遗泽） */
  function combatOf(s) {
    var base = (D.COMBAT_COEF[s.apt] * Math.pow(s.lvl, 2.4) + (s.combatExtra || 0)) * (s.combatMul || 1);
    if (has(s.legacy, "xianGu")) base *= 1.15;
    return Math.round(base);
  }

  function realmOf(lvl) { return Math.min(9, Math.floor((lvl - 1) / 10)); }

  function stageName(lvl) {
    if (lvl >= 99) return "巅峰";
    var inRealm = ((lvl - 1) % 10) + 1;
    return inRealm + " 层";
  }

  function fmtNum(n) {
    var neg = n < 0; n = Math.abs(Math.round(n));
    var t;
    if (n >= 100000000) t = (n / 100000000).toFixed(1).replace(/\.0$/, "") + " 亿";
    else if (n >= 10000) t = (n / 10000).toFixed(1).replace(/\.0$/, "") + " 万";
    else t = String(n);
    return (neg ? "-" : "") + t;
  }

  /* ---------- 开局 ---------- */
  function newRun(playerLv, achBonus, opts) {
    opts = opts || {};
    var legacy = opts.legacy || {};
    var saga = opts.saga || null;
    var trait = traitById(opts.trait);
    var carried = [];
    if (opts.equipment && opts.equipment.length) {
      for (var ei = 0; ei < opts.equipment.length; ei++) {
        var e = equipmentById(opts.equipment[ei]);
        if (e) carried.push(e);
      }
    }
    var d = drawRoot(playerLv, achBonus, legacy);
    var baseLife = irand(40 + d.apt * 5, 60 + d.apt * 7);
    if (has(legacy, "mingHuo")) baseLife += 25;
    if (has(legacy, "lifeMul")) baseLife = Math.round(baseLife * 1.12);
    /* 道谊深厚（累世结交道友）→ 寿元绵长 */
    if (saga && saga.dao > 0) baseLife += Math.round(Math.min(90, saga.dao * 3));
    var startLvl = 1;
    if (has(legacy, "startLvl")) startLvl = 6;
    if (trait && trait.passive && trait.passive.startLvl) startLvl = Math.max(startLvl, trait.passive.startLvl);
    if (trait && trait.passive && trait.passive.life) baseLife += trait.passive.life;
    baseLife = Math.max(1, baseLife);
    var s = {
      apt: d.apt, root: d.root,
      lvl: startLvl, age: 6,
      lifeMax: baseLife,
      combatExtra: 0,
      cultBonus: 0,
      combatMul: 1,
      breakMul: 1,
      xpMul: 1,
      charm: 0,
      trait: opts.trait || null,
      birthEquipment: carried,
      equipment: [],
      birthFlavor: "",
      xianyuan: null,
      ascended: false,
      dead: false,
      cause: "",
      combo: 0, comboBest: 0,
      misses: [],
      caught: 0,
      choicesMade: 0,
      legacy: legacy,
      saga: saga,
      tribAnnounced: false,
      tribYear: false,
      lastChoiceAge: 0,
      lastCatchAge: 0,
      lastInteractAge: 0,
      beatRival: false,
      bond: null,
      bondChosen: false,
      foeLvl: 1,
      rival: null,
      log: []
    };
    /* 命格词条被动效果 */
    if (trait && trait.passive) {
      if (trait.passive.combatMul) s.combatMul *= trait.passive.combatMul;
      if (trait.passive.breakMul) s.breakMul *= trait.passive.breakMul;
      if (trait.passive.xpMul) s.xpMul *= trait.passive.xpMul;
      if (trait.passive.charm) s.charm += trait.passive.charm;
      if (trait.passive.cultBonus) s.cultBonus += trait.passive.cultBonus;
    }
    /* 转世携带法宝：出生即生效 */
    var birthFlavor = [];
    for (var ci = 0; ci < carried.length; ci++) {
      var ce = carried[ci];
      if (ce.charm) s.charm += ce.charm;
      if (ce.combatMul) s.combatMul *= ce.combatMul;
      if (ce.breakMul) s.breakMul *= ce.breakMul;
      if (ce.xpMul) s.xpMul *= ce.xpMul;
      if (ce.eff) applyEff(s, ce.eff);
      birthFlavor.push('<div class="birth-equip">' + ce.icon + " " + ce.name + "　" + ce.desc + "</div>");
    }
    if (trait) {
      birthFlavor.unshift('<div class="birth-trait ' + (trait.kind === "凶" ? "bad" : trait.kind === "吉" ? "good" : "neutral") + '">命格词条 · <b>' + trait.name + "</b>　" + trait.desc + "</div>");
    }
    s.birthFlavor = birthFlavor.join("");
    /* 宿怨未消（累世死敌）→ 起手更狠，带着恨意入世 */
    if (saga && saga.grudge > 0) {
      s.combatExtra += Math.round(Math.min(6000, saga.grudge * 150) * (1 + d.apt * 0.06));
    }
    var birthExtra = [];
    if (trait) birthExtra.push("命格词条【" + trait.name + "】");
    for (var cj = 0; cj < carried.length; cj++) birthExtra.push("怀中抱着「" + carried[cj].name + "」");
    s.log.push({
      age: 6, type: "awake",
      text: "觉醒「" + d.root + "」，先天资质 " + d.apt + "（" + D.APT_TITLES[d.apt] + "），寿元 " + baseLife + " 年" +
        (startLvl > 1 ? "，携前世余温起步于 " + startLvl + " 级" : "") +
        (birthExtra.length ? "，" + birthExtra.join("、") : "")
    });
    s.rival = makeRival(s);
    return s;
  }

  /* ---------- 同代宿敌：并行模拟一整世，产出里程碑时间线 ---------- */
  function makeRival(player) {
    var name = pick(D.RIVAL_NAMES);
    var apt = clamp(player.apt + irand(-1, 1), 1, 10);
    var life = irand(40 + apt * 5, 60 + apt * 7);
    var st = {
      apt: apt, lvl: 1, age: 6, lifeMax: life, combatExtra: 0,
      cultBonus: 0, xianyuan: null, ascended: false, dead: false,
      cause: "", combo: 0, comboBest: 0, misses: [], caught: 0,
      combatMul: 1, breakMul: 1, xpMul: 1, charm: 0, trait: null, equipment: [],
      legacy: {}, tribAnnounced: true, tribYear: false,
      lastChoiceAge: -999, lastCatchAge: -999, log: []
    };
    var timeline = [];
    var seenRealms = {};
    var guard = 0;
    while (!st.dead && !st.ascended && st.age < st.lifeMax && guard++ < 4000) {
      var logs = stepYear(st, true);
      for (var i = 0; i < logs.length; i++) {
        var L = logs[i];
        if (L.type === "realm") {
          var rl = realmOf(st.lvl);
          if (!seenRealms[rl]) {
            seenRealms[rl] = true;
            timeline.push({ age: st.age, lvl: st.lvl, text: "宿敌「" + name + "」突破【" + D.REALMS[rl] + "】", type: "rival" });
          }
        }
      }
      if (st.lvl >= 99 && !st.ascended) {
        var p = D.TRIB_BASE[st.apt] / 100 * (st.xianyuan ? 2 : 1);
        if (rng() < p) {
          st.ascended = true;
          timeline.push({ age: st.age, lvl: st.lvl, text: "宿敌「" + name + "」竟率先渡劫飞升！", type: "rival" });
          break;
        }
      }
    }
    if (!st.ascended) {
      st.dead = true;
      timeline.push({ age: st.age, lvl: st.lvl, text: "宿敌「" + name + "」寿元耗尽，坐化而去（终 " + st.lvl + " 级）", type: "rival" });
    }
    return {
      name: name, apt: apt, finalLvl: st.lvl,
      ascended: st.ascended, deathAge: st.age,
      timeline: timeline
    };
  }

  /* ---------- 命格词条：每年随机触发一次 ---------- */
  function traitTick(s, logs) {
    if (!s.trait || !logs) return;
    var tr = traitById(s.trait);
    if (!tr || !tr.trigger || !tr.trigger.p) return;
    if (rng() >= tr.trigger.p) return;
    var text = tr.trigger.text && tr.trigger.text.length ? pick(tr.trigger.text) : tr.name + " 隐隐发动";
    var applied = applyEff(s, tr.trigger.eff || {});
    logs.push({
      age: s.age, type: tr.kind === "凶" ? "down" : "good",
      text: "【命格·" + tr.name + "】" + text + (applied || "")
    });
  }

  /* ---------- 单年推进 ----------
   * silentRival=true 时用于宿敌模拟：屏蔽抉择 / 机缘 / 渡劫提示 */
  function stepYear(s, silentRival) {
    var logs = [];
    s.age++;
    s.tribYear = false;
    traitTick(s, logs);

    /* 寿终 */
    if (s.age > s.lifeMax) {
      s.dead = true;
      s.cause = "寿元耗尽，坐化于洞府之中";
      logs.push({ age: s.age, type: "end", text: "你感到生机枯竭，盘坐而化，这一生落幕了。" });
      return logs;
    }

    /* 99 级：渡劫窗口（交由 UI 拔河；宿敌模拟里由 makeRival 直接判定） */
    if (s.lvl >= 99) {
      if (!s.tribAnnounced) {
        s.tribAnnounced = true;
        logs.push({ age: s.age, type: "gold", text: "已至半步真仙之巅，天门在望——是时候引动九天雷劫，渡劫飞升！" });
      }
      if (!silentRival) s.tribYear = true;
      /* 巅峰年份偶有感悟 */
      var ev99 = pickEvent(99, 9);
      if (ev99) logs.push({ age: s.age, text: ev99.text + applyEff(s, ev99.eff), type: evType(ev99) });
      return logs;
    }

    /* 90 级后：每年概率获得仙缘（最多 1 种） */
    if (!s.xianyuan && s.lvl >= 90 && rng() < D.XIAN_YUAN_CHANCE) {
      var xy = pick(D.XIAN_YUAN);
      s.xianyuan = xy;
      logs.push({ age: s.age, type: "gold", text: "天降异象！获得仙缘「" + xy.name + "」（渡劫时战力达 " + fmtNum(xy.needCombat) + " 可走引仙台）" });
    }

    if (!silentRival) {
      /* 交互冷却（随境界缩放），保证流年不被频繁打断 */
      var cd = interactCd(s.lvl);
      /* 抉择事件：暂停流年，二选一 */
      if (s.age - (s.lastInteractAge || 0) >= cd && rng() < 0.04) {
        var pool = D.CHOICES.filter(function (c) { return s.lvl >= c.min && s.lvl <= c.max; });
        if (pool.length) {
          var ch = pick(pool);
          s.lastChoiceAge = s.age; s.lastInteractAge = s.age;
          logs.push({ age: s.age, type: "choice", choice: ch, text: "【" + ch.title + "】" + ch.text });
          return logs;
        }
      }
      /* 天降机缘：限时点击接取 */
      var catchP = 0.032 * (has(s.legacy, "fuYun") ? 1.8 : 1);
      if (s.age - (s.lastInteractAge || 0) >= cd && rng() < catchP) {
        var item = pick(D.CATCH_ITEMS);
        s.lastCatchAge = s.age; s.lastInteractAge = s.age;
        logs.push({ age: s.age, type: "catch", item: item, text: "天边一道流光坠落——是「" + item.name + "」！快接住它！" });
        return logs;
      }
      /* 法宝装备：随机掉落，结算时可选择带入下一世 */
      var equipP = 0.018 * (has(s.legacy, "fuYun") ? 1.7 : 1) * (1 + Math.min(0.5, (s.charm || 0) * 0.005));
      if (s.age - (s.lastInteractAge || 0) >= cd && rng() < equipP) {
        var eq = pick(D.EQUIPMENT);
        s.lastInteractAge = s.age;
        logs.push({ age: s.age, type: "equip", item: eq, text: "天光乍破，一件法宝「" + eq.name + "」坠落在你面前！" });
        return logs;
      }
    }

    /* 随机事件（按等级段 + 境界过滤） */
    var ev = pickEvent(s.lvl, realmOf(s.lvl));
    if (ev) logs.push({ age: s.age, text: ev.text + applyEff(s, ev.eff), type: evType(ev) });

    /* 宿敌羁绊：道友论道 / 死敌压迫（仅作用于玩家） */
    var rname = s.rival ? s.rival.name : "宿敌";
    if (s.bond === "friend" && rng() < 0.06) {
      s.cultBonus += 14;
      logs.push({ age: s.age, type: "up", text: "与道友「" + rname + "」坐而论道，互证道法，感悟大增" });
    }
    if (s.bond === "enemy" && (s.foeLvl || 0) > s.lvl && rng() < 0.08) {
      logs.push({ age: s.age, type: "rival", text: "被死敌「" + rname + "」甩在身后，你咬碎钢牙，愤而精进！" });
    }

    /* 突破判定：感悟乘算加成；夙世悟性 ×1.06；概率 >30% 允许连破（每次减半，最多 3 次） */
    var broke = 0;
    var p = breakChance(s.apt, s.lvl) * (1 + s.cultBonus / 100) * (s.breakMul || 1);
    if (has(s.legacy, "suZhi")) p *= 1.06;
    /* 死敌压迫感：落后时怒而突破(+18%)，领先时道心锐利(+6%) */
    if (s.bond === "enemy") p *= ((s.foeLvl || 0) > s.lvl) ? 1.18 : 1.06;
    while (s.lvl < 99 && p > 0 && broke < 3) {
      if (rng() < p) {
        var oldRealm = realmOf(s.lvl);
        s.lvl++;
        broke++;
        var newRealm = realmOf(s.lvl);
        if (newRealm > oldRealm) {
          s.lifeMax += D.REALM_LIFE[newRealm];
          logs.push({ age: s.age, type: "realm", text: "突破大境界！晋升【" + D.REALMS[newRealm] + "】，寿元大增（+" + D.REALM_LIFE[newRealm] + "）" });
          if (s.lvl === 99) logs.push({ age: s.age, type: "gold", text: "已至半步真仙之巅，此后每年皆可尝试渡劫飞升！" });
        } else {
          logs.push({ age: s.age, type: "up", text: "修为突破，晋升" + D.REALMS[newRealm] + " " + stageName(s.lvl) });
        }
        if (p <= 0.3) break;
        p = p / 2;
      } else break;
    }

    /* combo 统计 */
    if (broke > 0) {
      s.combo += broke;
      if (s.combo > s.comboBest) s.comboBest = s.combo;
    } else {
      s.combo = 0;
    }

    /* 感悟衰减 */
    s.cultBonus = Math.max(0, s.cultBonus * 0.4);
    return logs;
  }

  /* ---------- 事件挑选（等级段 + 境界双重过滤） ---------- */
  function pickEvent(lvl, realm) {
    var rl = (realm === undefined) ? realmOf(lvl) : realm;
    var pool = D.EVENTS.filter(function (e) {
      var lvlOk = lvl >= e.min && lvl <= e.max;
      var realmOk = (e.realm === undefined) || (e.realm === rl);
      return lvlOk && realmOk;
    });
    if (!pool.length) return null;
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i].w;
    var r = rng() * total, acc = 0;
    for (i = 0; i < pool.length; i++) { acc += pool[i].w; if (r < acc) return pool[i]; }
    return pool[pool.length - 1];
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

  /* ---------- 效果应用（随机事件 / 抉择 / 机缘 共用） ---------- */
  function applyEff(s, eff) {
    eff = eff || {};
    var parts = [];
    if (eff.xp) {
      var v = Math.round(rand(eff.xp[0], eff.xp[1]));
      if (v >= 0) {
        v = Math.round(v * (s.xpMul || 1));
        if (has(s.legacy, "daoHen")) v = Math.round(v * 1.3);
      }
      s.cultBonus = Math.max(0, s.cultBonus + v);
      parts.push(v >= 0 ? "（感悟 +" + v + "）" : "（感悟 " + v + "）");
    }
    if (eff.life) {
      var l = Math.round(rand(eff.life[0], eff.life[1]));
      s.lifeMax += l;
      parts.push(l >= 0 ? "（寿元 +" + l + "）" : "（寿元 " + l + "）");
    }
    if (eff.combat) {
      var base = D.COMBAT_COEF[s.apt] * Math.pow(s.lvl, 2.4);
      var c = Math.round(base * rand(eff.combat[0], eff.combat[1]));
      s.combatExtra += c;
      parts.push(c >= 0 ? "（战力 +" + fmtNum(c) + "）" : "（战力 " + fmtNum(c) + "）");
    }
    return parts.join("");
  }

  function applyEvent(s, ev) { return applyEff(s, ev.eff); }

  /* ---------- 交互小游戏奖励放大：只放大「正向」区间，惩罚不变 ---------- */
  var CHOICE_REWARD_MUL = 2.0;   /* 两难抉择 */
  var CATCH_REWARD_MUL = 2.4;    /* 天降机缘 */
  function boostEff(eff, mul) {
    if (!eff) return eff;
    var out = {};
    Object.keys(eff).forEach(function (k) {
      var v = eff[k];
      if (Array.isArray(v) && v[1] > 0) out[k] = [v[0] * mul, v[1] * mul];
      else out[k] = v;
    });
    return out;
  }

  /* ---------- 抉择结算 ---------- */
  function resolveChoice(s, choice, optIdx) {
    var opt = choice.opts[clamp(optIdx | 0, 0, choice.opts.length - 1)];
    var outs = opt.outcomes, i;
    var total = 0;
    for (i = 0; i < outs.length; i++) total += outs[i].p;
    var r = rng() * total, acc = 0, chosen = outs[outs.length - 1];
    for (i = 0; i < outs.length; i++) { acc += outs[i].p; if (r < acc) { chosen = outs[i]; break; } }
    s.choicesMade++;
    var applied = applyEff(s, boostEff(chosen.eff, CHOICE_REWARD_MUL));
    return { opt: opt, outcome: chosen, applied: applied };
  }

  /* ---------- 天降机缘：接住 / 错失 ---------- */
  function catchItem(s, item) {
    s.caught++;
    var applied = applyEff(s, boostEff(item.eff, CATCH_REWARD_MUL));
    return applied;
  }
  function missCatch(s, item) {
    s.misses.push({ age: s.age, name: item.name, eff: item.eff });
    return null;
  }

  function collectEquipment(s, item) {
    if (!s.equipment) s.equipment = [];
    for (var i = 0; i < s.equipment.length; i++) {
      if (s.equipment[i].id === item.id) return null;
    }
    s.equipment.push(item);
    return item;
  }

  /* ---------- 渡劫拔河（技能化 QTE） ---------- */
  var TRIB_TIME = 8;    /* 秒 */
  var TRIB_CLICK = 3;   /* 每次点击/按压进度（百分点） */
  function tribDrain(s) {
    var d = Math.max(1.2, (9 - s.apt * 0.55) * (s.xianyuan ? 0.5 : 1));
    if (s.bond === "friend") d = Math.max(1.0, d * 0.85); /* 道友护道，天劫侵蚀减轻 */
    return d;
  }
  function tribInfo(s) {
    return { time: TRIB_TIME, click: TRIB_CLICK, drain: tribDrain(s), need: 100 };
  }
  function ascendNow(s) {
    s.ascended = true;
    var combat = combatOf(s);
    var rate = s.xianyuan ? s.xianyuan.rate : 1;
    var finalCombat = Math.round(combat * rate);
    return {
      age: s.age, combat: finalCombat,
      viaXianTai: !!s.xianyuan,
      text: s.xianyuan
        ? "以仙缘「" + s.xianyuan.name + "」叩开引仙台，霞光万丈，白日飞升！"
        : "雷云散尽，天门洞开——渡劫成功，霞光万丈，白日飞升！"
    };
  }
  function tribFail(s) {
    var dmg = Math.round(s.lifeMax * rand(0.08, 0.18));
    s.lifeMax -= dmg;
    var dead = s.lifeMax <= s.age;
    if (dead) { s.dead = true; s.cause = "渡劫失败，遭天劫反噬而陨"; }
    return { age: s.age, dmg: dmg, dead: dead };
  }

  /* ---------- 结算经验 ---------- */
  function runExp(r) {
    var asc = r.ascended || r.ascend ? 300 : 0;
    return Math.floor(r.lvl * 2 + asc + combatOf(r) / 5000 + (r.comboBest || 0) * 5);
  }

  return {
    setRng: setRng, rnd: function () { return rng(); }, hashStr: hashStr, mulberry32: mulberry32,
    INTERACT_CD: INTERACT_CD, interactCd: interactCd,
    drawRoot: drawRoot, breakChance: breakChance, combatOf: combatOf,
    realmOf: realmOf, stageName: stageName, fmtNum: fmtNum,
    newRun: newRun, stepYear: stepYear, runExp: runExp,
    pickEvent: pickEvent, applyEff: applyEff, applyEvent: applyEvent,
    resolveChoice: resolveChoice, catchItem: catchItem, missCatch: missCatch,
    collectEquipment: collectEquipment,
    TRIB_TIME: TRIB_TIME, TRIB_CLICK: TRIB_CLICK, tribDrain: tribDrain,
    tribInfo: tribInfo, ascendNow: ascendNow, tribFail: tribFail
  };
});
