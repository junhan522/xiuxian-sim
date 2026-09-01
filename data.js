/* ============================================================
 * 修仙模拟器 · 数据文件（纯数据：境界 / 灵根 / 仙缘 / 事件 / 成就）
 * 逻辑见 sim.js，界面见 game.js —— 全部为原创内容
 * ============================================================ */
(function (root) {
  /* 境界：等级 1-99，每 10 级一个大境界 */
  var REALMS = [
    "炼气", "筑基", "金丹", "元婴", "化神",
    "炼虚", "合体", "大乘", "渡劫", "真仙"
  ];

  /* 境界寿元加成：突破到该境界时增加的寿元（年） */
  var REALM_LIFE = [0, 30, 50, 90, 150, 240, 360, 520, 720, 0];

  /* 战力系数：下标 = 先天资质（1-10），战力 = 系数 × 等级^2.4 + 额外战力 */
  var COMBAT_COEF = [0, 0.5, 0.8, 1.2, 1.8, 2.6, 3.8, 5.4, 7.6, 10.5, 14.5];

  /* 突破概率表（百分比，可 >100%）
   * 行 = 先天资质 1-10
   * 列 = 境界段：炼气 / 筑基 / 金丹 / 元婴 / 化神 / 炼虚 / 合体 / 大乘 / 渡劫(81-90) / 半步真仙(91-98) / 99 */
  var BREAK_CHANCE = [
    [20, 8, 3, 1, 0.5, 0.3, 0.12, 0.06, 0.06, 0.06, 0.06],
    [35, 15, 6, 2.5, 1, 0.5, 0.18, 0.1, 0.09, 0.07, 0.07],
    [55, 28, 12, 5, 2, 1, 0.3, 0.18, 0.13, 0.1, 0.09],
    [75, 45, 22, 10, 4, 2, 0.6, 0.3, 0.2, 0.14, 0.12],
    [95, 60, 30, 12, 4.5, 2, 0.55, 0.26, 0.16, 0.11, 0.09],
    [120, 90, 50, 24, 10, 5, 1.3, 0.6, 0.35, 0.22, 0.16],
    [150, 115, 70, 36, 16, 8, 2.2, 1, 0.6, 0.38, 0.26],
    [200, 160, 105, 58, 28, 14, 4, 1.9, 1, 0.65, 0.45],
    [260, 200, 145, 85, 45, 24, 7, 3.6, 1.9, 1.2, 0.85],
    [320, 260, 195, 125, 70, 40, 13, 6.5, 3.5, 2.3, 1.6]
  ];

  /* 灵根：按先天资质分组，觉醒时先按权重抽资质，再在组内随机取名 */
  var INNATE_WEIGHTS = [0, 20, 19, 16, 13, 12, 9, 6, 3, 1.5, 0.5];
  var ROOTS = {
    1: ["五行杂灵根", "尘土灵根", "枯木灵根", "顽石灵根", "杂草灵根"],
    2: ["四行灵根", "青苇灵根", "铁砂灵根", "灰岩灵根"],
    3: ["三土灵根", "赤铜灵根", "江流灵根", "松纹灵根"],
    4: ["双灵根", "风痕灵根", "霜纹灵根", "烛照灵根"],
    5: ["明月灵根", "紫金利根", "玉骨灵根", "星屑灵根"],
    6: ["雷音灵根", "剑骨灵根", "大日灵根", "玄冰灵根"],
    7: ["冰魄灵根", "真火灵根", "星辰灵根", "紫霄灵根"],
    8: ["真龙灵根", "麒麟灵根", "天罡灵根", "金乌灵根"],
    9: ["天灵根", "凤凰灵根", "虚空灵根", "琉璃灵根"],
    10: ["混沌灵根", "太初道体", "九叶莲体", "鸿蒙道体"]
  };

  /* 资质称号 */
  var APT_TITLES = {
    1: "朽木之资", 2: "平庸之资", 3: "寻常之资", 4: "尚可之资",
    5: "良才之资", 6: "上佳之资", 7: "天骄之资", 8: "绝世之资",
    9: "谪仙之资", 10: "万古一遇"
  };

  /* 仙缘（90 级后每年有机会获得一种，最多 1 种）：
   * 渡劫时若战力达标，可用仙缘「引仙台」代替硬渡天劫，成功率更高；
   * rate：飞升后最终战力增幅倍率 */
  var XIAN_YUAN = [
    { id: "jian", name: "剑仙缘——青莲剑痕", needCombat: 200000, rate: 1.45 },
    { id: "dan", name: "丹仙缘——九转丹炉", needCombat: 220000, rate: 1.55 },
    { id: "lei", name: "雷仙缘——九霄雷符", needCombat: 240000, rate: 1.65 },
    { id: "yin", name: "音仙缘——太古焦尾", needCombat: 250000, rate: 1.75 },
    { id: "qi", name: "棋仙缘——星罗棋盘", needCombat: 260000, rate: 1.85 },
    { id: "shu", name: "书仙缘——无字天书", needCombat: 270000, rate: 1.95 },
    { id: "hua", name: "画仙缘——山河社稷图", needCombat: 280000, rate: 2.05 },
    { id: "meng", name: "梦仙缘——大梦千秋蝶", needCombat: 300000, rate: 2.15 }
  ];
  /* 90 级后每年获得仙缘的概率 */
  var XIAN_YUAN_CHANCE = 0.12;
  /* 引仙台成功率（战力达标时），硬渡天劫用 TRIB_BASE */
  var XIAN_TAI_CHANCE = 0.22;
  /* 硬渡天劫基础成功率（百分比，按资质） */
  var TRIB_BASE = [0, 0.8, 0.9, 1.0, 1.1, 1.2, 1.4, 1.6, 1.9, 2.2, 2.6];
  /* 渡劫失败反噬概率（扣寿元） */
  var TRIB_BACKLASH = 0.25;

  /* 随机事件：w=权重，min/max=生效等级段，eff 由 sim 解释
   * eff.xp = 感悟（百分点）；eff.life = 寿元（年）；eff.combat = 战力（基础战力百分比） */
  var EVENTS = [
    /* ---- 修炼增益类 ---- */
    { w: 10, min: 1, max: 98, text: "在后山石洞中捡到一页残破功法，似有所悟", eff: { xp: [4, 12] } },
    { w: 8, min: 11, max: 98, text: "观摩长辈讲道，茅塞顿开，修为精进", eff: { xp: [6, 18] } },
    { w: 6, min: 21, max: 98, text: "枯坐崖畔三载，一朝顿悟，灵气灌体", eff: { xp: [10, 26] } },
    { w: 5, min: 41, max: 98, text: "于上古遗迹参悟碑文，道心通明", eff: { xp: [16, 36] } },
    { w: 4, min: 61, max: 98, text: "与隐世高人论道七日，胜读百年道藏", eff: { xp: [22, 48] } },
    /* ---- 寿元类 ---- */
    { w: 8, min: 1, max: 98, text: "误食一株百年灵果，神清气爽，寿元渐长", eff: { life: [2, 8] } },
    { w: 6, min: 21, max: 98, text: "寻得一眼灵泉，日日吐纳，肉身不衰", eff: { life: [5, 15] } },
    { w: 5, min: 41, max: 98, text: "炼制延寿丹药成功，气血回春", eff: { life: [10, 30] } },
    { w: 4, min: 1, max: 40, text: "修炼急进，气血亏空，寿元有损", eff: { life: [-12, -4] } },
    { w: 3, min: 31, max: 98, text: "冲击瓶颈失败遭反噬，根基受损", eff: { life: [-25, -8], xp: [-12, -4] } },
    /* ---- 战力 / 法宝类 ---- */
    { w: 8, min: 1, max: 98, text: "集市淘到一柄蒙尘旧剑，竟是件法器", eff: { combat: [0.04, 0.1] } },
    { w: 6, min: 11, max: 98, text: "炼器有成，本命法宝初成", eff: { combat: [0.06, 0.15] } },
    { w: 5, min: 31, max: 98, text: "斩妖除魔历练归来，斗法经验大涨", eff: { combat: [0.1, 0.2] } },
    { w: 4, min: 51, max: 98, text: "得上古大能传承，神通初成", eff: { combat: [0.15, 0.3], xp: [8, 20] } },
    { w: 4, min: 71, max: 98, text: "淬炼仙骨，肉身成圣，战力暴涨", eff: { combat: [0.2, 0.4] } },
    /* ---- 凶险类 ---- */
    { w: 5, min: 1, max: 60, text: "进山采药被毒蛇咬伤，卧床半月", eff: { life: [-6, -2] } },
    { w: 4, min: 11, max: 80, text: "遭遇妖修偷袭，拼死逃脱，元气大伤", eff: { life: [-15, -6], combat: [-0.08, -0.03] } },
    { w: 3, min: 21, max: 98, text: "心魔滋生，闭关走火，幸而及时清醒", eff: { life: [-18, -6] } },
    { w: 2, min: 1, max: 20, text: "卷入凡人帮派仇杀，险些丧命", eff: { life: [-8, -3] } },
    { w: 3, min: 61, max: 98, text: "渡虚之时遭遇空间乱流，侥幸脱身", eff: { life: [-40, -12] } },
    /* ---- 奇遇类 ---- */
    { w: 3, min: 1, max: 98, text: "救下一只受伤灵鹤，结下善缘", eff: { xp: [4, 10], life: [2, 6] } },
    { w: 3, min: 1, max: 98, text: "梦中得一白发老者点拨，醒来修为隐有松动", eff: { xp: [6, 16] } },
    { w: 2, min: 31, max: 98, text: "误入洞天福地，灵气如潮，功法自行运转", eff: { xp: [14, 30], life: [5, 15] } },
    { w: 2, min: 51, max: 98, text: "观星河运转忽有所感，悟出一门神通", eff: { xp: [12, 28], combat: [0.08, 0.16] } },
    { w: 2, min: 1, max: 98, text: "被宗门长老看中，收记名弟子", eff: { xp: [5, 14] } },
    /* ---- 平淡日常 ---- */
    { w: 16, min: 1, max: 98, text: "闭关苦修，未有寸进，好在道心稳固", eff: {} },
    { w: 12, min: 1, max: 98, text: "下山历练，见识风土人情", eff: {} },
    { w: 8, min: 1, max: 98, text: "与同门论道切磋，互有胜负", eff: { xp: [2, 6] } },
    { w: 8, min: 1, max: 30, text: "替宗门打理灵田，赚了些灵石", eff: {} },
    { w: 6, min: 11, max: 98, text: "参加坊市拍卖，看了回热闹", eff: {} }
  ];

  /* 成就：cond 在结算时判定，bonus 为高阶灵根概率加成（百分点） */
  var ACHIEVEMENTS = [
    { id: "a_zhuji", name: "初入修行", desc: "突破至筑基", bonus: 0.2, cond: "lvl>=11" },
    { id: "a_jindan", name: "结丹有成", desc: "突破至金丹", bonus: 0.3, cond: "lvl>=21" },
    { id: "a_yuanying", name: "元婴老怪", desc: "突破至元婴", bonus: 0.5, cond: "lvl>=31" },
    { id: "a_dasheng", name: "大乘尊者", desc: "突破至大乘", bonus: 0.8, cond: "lvl>=71" },
    { id: "a_dujie", name: "渡劫真人", desc: "修至渡劫期（81 级）", bonus: 0.8, cond: "lvl>=81" },
    { id: "a_jiuwu", name: "半步真仙", desc: "修至 99 级巅峰", bonus: 1, cond: "lvl>=99" },
    { id: "a_feisheng", name: "白日飞升", desc: "首次飞升成仙", bonus: 1.5, cond: "ascend" },
    { id: "a_sanci", name: "三登仙班", desc: "累计飞升 3 次", bonus: 1.5, cond: "ascends>=3" },
    { id: "a_xianyuan", name: "仙缘天授", desc: "获得过仙缘", bonus: 0.6, cond: "xianyuan" },
    { id: "a_zhanli", name: "战力超群", desc: "单局战力超过 20 万", bonus: 0.5, cond: "combat>=200000" },
    { id: "a_zaoyao", name: "天妒英才", desc: "资质 ≥7 却在 30 岁前身陨", bonus: 0.4, cond: "apt>=7&&age<30" },
    { id: "a_shici", name: "十世轮回", desc: "累计游玩 10 局", bonus: 0.6, cond: "runs>=10" }
  ];

  /* 玩家等级经验：每级所需经验 = 50 + (lv-1)*25 */
  function expNeed(lv) { return 50 + (Math.max(1, lv) - 1) * 25; }

  /* 结算称号：按最终境界 */
  function runTitle(r) {
    if (r.ascend) return "飞升成仙";
    if (r.lvl >= 99) return "半步真仙";
    if (r.lvl >= 81) return "渡劫真人";
    if (r.lvl >= 61) return "合体大能";
    if (r.lvl >= 41) return "化神修士";
    if (r.lvl >= 21) return "金丹上人";
    if (r.lvl >= 11) return "筑基修士";
    return "凡尘过客";
  }

  var DATA = {
    REALMS: REALMS, REALM_LIFE: REALM_LIFE, COMBAT_COEF: COMBAT_COEF,
    BREAK_CHANCE: BREAK_CHANCE, INNATE_WEIGHTS: INNATE_WEIGHTS, ROOTS: ROOTS,
    APT_TITLES: APT_TITLES, XIAN_YUAN: XIAN_YUAN, XIAN_YUAN_CHANCE: XIAN_YUAN_CHANCE,
    XIAN_TAI_CHANCE: XIAN_TAI_CHANCE, TRIB_BASE: TRIB_BASE, TRIB_BACKLASH: TRIB_BACKLASH,
    EVENTS: EVENTS, ACHIEVEMENTS: ACHIEVEMENTS,
    expNeed: expNeed, runTitle: runTitle
  };

  root.DATA = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})(typeof self !== "undefined" ? self : this);
