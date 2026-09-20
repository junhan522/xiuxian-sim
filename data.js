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
   * eff.xp = 感悟（百分点）；eff.life = 寿元（年）；eff.combat = 战力（基础战力百分比）
   * 事件按境界分段，避免高境界修士遇到「误食百年灵果」之类低阶机缘。
   * sim.pickEvent 会同时按等级段与当前境界 realm 过滤。 */
  var EVENTS = [
    /* ==================== 炼气（1-10）凡尘稚修 ==================== */
    { w: 12, min: 1, max: 10, realm: 0, text: "在后山石洞中捡到一页残破功法，似有所悟", eff: { xp: [4, 12] } },
    { w: 10, min: 1, max: 10, realm: 0, text: "误食一株百年灵果，神清气爽，寿元渐长", eff: { life: [2, 8] } },
    { w: 8, min: 1, max: 10, realm: 0, text: "集市淘到一柄蒙尘旧剑，竟是件法器", eff: { combat: [0.04, 0.1] } },
    { w: 8, min: 1, max: 10, realm: 0, text: "被宗门长老看中，收为记名弟子", eff: { xp: [5, 14] } },
    { w: 8, min: 1, max: 10, realm: 0, text: "救下一只受伤灵鹤，结下善缘", eff: { xp: [4, 10], life: [2, 6] } },
    { w: 6, min: 1, max: 10, realm: 0, text: "进山采药被毒蛇咬伤，卧床半月", eff: { life: [-6, -2] } },
    { w: 5, min: 1, max: 10, realm: 0, text: "卷入凡人帮派仇杀，险些丧命", eff: { life: [-8, -3] } },
    { w: 6, min: 1, max: 10, realm: 0, text: "修炼急进，气血亏空，寿元有损", eff: { life: [-10, -4] } },
    { w: 18, min: 1, max: 10, realm: 0, text: "替宗门打理灵田，赚了些灵石", eff: {} },
    { w: 16, min: 1, max: 10, realm: 0, text: "打坐吐纳，未有寸进，好在道心稳固", eff: {} },

    /* ==================== 筑基（11-20） ==================== */
    { w: 12, min: 11, max: 20, realm: 1, text: "观摩长辈讲道，茅塞顿开，修为精进", eff: { xp: [6, 18] } },
    { w: 9, min: 11, max: 20, realm: 1, text: "梦中得一白发老者点拨，醒来修为隐有松动", eff: { xp: [8, 18] } },
    { w: 8, min: 11, max: 20, realm: 1, text: "炼器有成，本命法器初成", eff: { combat: [0.06, 0.15] } },
    { w: 8, min: 11, max: 20, realm: 1, text: "寻得一眼灵泉，日日吐纳，肉身不衰", eff: { life: [5, 15] } },
    { w: 6, min: 11, max: 20, realm: 1, text: "下山历练，遭遇妖修偷袭，拼死逃脱", eff: { life: [-15, -6], combat: [-0.08, -0.03] } },
    { w: 6, min: 11, max: 20, realm: 1, text: "冲击瓶颈失败遭反噬，根基受损", eff: { life: [-18, -8], xp: [-10, -4] } },
    { w: 16, min: 11, max: 20, realm: 1, text: "参加坊市拍卖，看了回热闹", eff: {} },
    { w: 14, min: 11, max: 20, realm: 1, text: "与同门论道切磋，互有胜负", eff: { xp: [2, 6] } },

    /* ==================== 金丹（21-30） ==================== */
    { w: 12, min: 21, max: 30, realm: 2, text: "枯坐崖畔三载，一朝顿悟，灵气灌体", eff: { xp: [10, 26] } },
    { w: 9, min: 21, max: 30, realm: 2, text: "炼制延寿丹药成功，气血回春", eff: { life: [8, 20] } },
    { w: 8, min: 21, max: 30, realm: 2, text: "斩妖除魔历练归来，斗法经验大涨", eff: { combat: [0.1, 0.2] } },
    { w: 8, min: 21, max: 30, realm: 2, text: "误入洞天福地，灵气如潮，功法自行运转", eff: { xp: [14, 30], life: [5, 15] } },
    { w: 6, min: 21, max: 30, realm: 2, text: "心魔滋生，闭关走火，幸而及时清醒", eff: { life: [-18, -8] } },
    { w: 6, min: 21, max: 30, realm: 2, text: "结丹引来天雷淬体，金丹略有裂痕", eff: { xp: [-14, -6] } },
    { w: 14, min: 21, max: 30, realm: 2, text: "开宗立派收徒讲道，声望渐起", eff: {} },

    /* ==================== 元婴（31-40） ==================== */
    { w: 12, min: 31, max: 40, realm: 3, text: "元婴出游千里，归来道行更深", eff: { xp: [16, 34] } },
    { w: 9, min: 31, max: 40, realm: 3, text: "于上古遗迹参悟碑文，道心通明", eff: { xp: [16, 36] } },
    { w: 8, min: 31, max: 40, realm: 3, text: "淬炼元婴法相，神通初成", eff: { combat: [0.15, 0.3] } },
    { w: 7, min: 31, max: 40, realm: 3, text: "寻得千年灵乳重塑肉身，寿元大增", eff: { life: [15, 35] } },
    { w: 6, min: 31, max: 40, realm: 3, text: "遭同阶老怪夺舍，重创元婴", eff: { life: [-30, -12] } },
    { w: 6, min: 31, max: 40, realm: 3, text: "渡三灾小劫，肉身几近崩坏", eff: { life: [-25, -10], combat: [-0.1, -0.04] } },
    { w: 12, min: 31, max: 40, realm: 3, text: "闭关参悟元婴大道，岁月无痕", eff: {} },

    /* ==================== 化神（41-50） ==================== */
    { w: 12, min: 41, max: 50, realm: 4, text: "神游太虚，窥见一丝天地法则", eff: { xp: [22, 44] } },
    { w: 9, min: 41, max: 50, realm: 4, text: "与隐世高人论道七日，胜读百年道藏", eff: { xp: [24, 48] } },
    { w: 8, min: 41, max: 50, realm: 4, text: "炼化一缕天地异火，战力暴涨", eff: { combat: [0.2, 0.4] } },
    { w: 7, min: 41, max: 50, realm: 4, text: "悟透生死轮转，寿元再延", eff: { life: [25, 55] } },
    { w: 6, min: 41, max: 50, realm: 4, text: "化神雷劫加身，神魂受创", eff: { life: [-40, -18] } },
    { w: 6, min: 41, max: 50, realm: 4, text: "卷入大能争锋，被余波震伤", eff: { combat: [-0.14, -0.06] } },
    { w: 10, min: 41, max: 50, realm: 4, text: "坐镇一方，受万修朝拜", eff: {} },

    /* ==================== 炼虚（51-60） ==================== */
    { w: 12, min: 51, max: 60, realm: 5, text: "观星河运转忽有所感，悟出一门大神通", eff: { xp: [30, 60], combat: [0.1, 0.2] } },
    { w: 9, min: 51, max: 60, realm: 5, text: "撕裂虚空遨游星域，道行大进", eff: { xp: [34, 66] } },
    { w: 8, min: 51, max: 60, realm: 5, text: "炼化一颗陨星之核，肉身成圣", eff: { combat: [0.25, 0.5] } },
    { w: 7, min: 51, max: 60, realm: 5, text: "参悟岁月之道，寿元暴涨", eff: { life: [40, 90] } },
    { w: 6, min: 51, max: 60, realm: 5, text: "渡虚之时遭遇空间乱流，侥幸脱身", eff: { life: [-50, -22] } },
    { w: 6, min: 51, max: 60, realm: 5, text: "虚空风暴撕裂法身，元气大伤", eff: { life: [-40, -18], combat: [-0.12, -0.05] } },
    { w: 8, min: 51, max: 60, realm: 5, text: "闭关炼虚，一梦百年", eff: {} },

    /* ==================== 合体（61-70） ==================== */
    { w: 12, min: 61, max: 70, realm: 6, text: "法天象地，与天地合一，感悟如潮", eff: { xp: [40, 80] } },
    { w: 9, min: 61, max: 70, realm: 6, text: "得一位陨落大能的完整传承", eff: { xp: [45, 85], combat: [0.15, 0.3] } },
    { w: 8, min: 61, max: 70, realm: 6, text: "淬炼合体法身，一拳碎星辰", eff: { combat: [0.3, 0.6] } },
    { w: 7, min: 61, max: 70, realm: 6, text: "得天地灵物续命，寿元再增", eff: { life: [60, 130] } },
    { w: 6, min: 61, max: 70, realm: 6, text: "合体之劫降临，法身几近崩解", eff: { life: [-80, -35] } },
    { w: 6, min: 61, max: 70, realm: 6, text: "与另一位合体老怪斗法两败俱伤", eff: { life: [-60, -28], combat: [-0.15, -0.07] } },
    { w: 8, min: 61, max: 70, realm: 6, text: "隐居世外，静观天地兴衰", eff: {} },

    /* ==================== 大乘（71-80） ==================== */
    { w: 12, min: 71, max: 80, realm: 7, text: "参悟大道本源，一举一动皆合天道", eff: { xp: [55, 110] } },
    { w: 9, min: 71, max: 80, realm: 7, text: "受上界垂青，得一道仙气灌顶", eff: { xp: [60, 120], combat: [0.2, 0.4] } },
    { w: 8, min: 71, max: 80, realm: 7, text: "凝练大乘道果，战力登峰造极", eff: { combat: [0.4, 0.8] } },
    { w: 7, min: 71, max: 80, realm: 7, text: "以大神通逆转气血，寿元绵长", eff: { life: [90, 200] } },
    { w: 6, min: 71, max: 80, realm: 7, text: "大乘雷劫提前降临，道基受创", eff: { life: [-120, -55] } },
    { w: 6, min: 71, max: 80, realm: 7, text: "强渡心魔大关，神魂受损", eff: { life: [-90, -45], xp: [-20, -8] } },
    { w: 8, min: 71, max: 80, realm: 7, text: "端坐云端，静待飞升之机", eff: {} },

    /* ==================== 渡劫（81-90） ==================== */
    { w: 14, min: 81, max: 90, realm: 8, text: "引动天地元气洗涤道体，距仙道更近一步", eff: { xp: [70, 140] } },
    { w: 10, min: 81, max: 90, realm: 8, text: "观摩一次他人渡劫，从中悟得劫数玄机", eff: { xp: [80, 160] } },
    { w: 9, min: 81, max: 90, realm: 8, text: "以渡劫之威淬炼仙躯，战力通天", eff: { combat: [0.5, 1.0] } },
    { w: 8, min: 81, max: 90, realm: 8, text: "得一枚仙家残果，寿元直追仙龄", eff: { life: [120, 260] } },
    { w: 7, min: 81, max: 90, realm: 8, text: "小渡天劫失败，被雷罚重创", eff: { life: [-160, -80] } },
    { w: 6, min: 81, max: 90, realm: 8, text: "仙道压制反噬，道心几近失守", eff: { life: [-120, -60], xp: [-30, -12] } },
    { w: 8, min: 81, max: 90, realm: 8, text: "闭关凝练半步仙力，静候天门", eff: {} },

    /* ==================== 真仙 / 巅峰（91-99） ==================== */
    { w: 20, min: 91, max: 99, realm: 9, text: "立于九天之巅，仙气缭绕，只待天门开启", eff: { xp: [40, 90] } },
    { w: 16, min: 91, max: 99, realm: 9, text: "回望漫漫修行路，道心愈发圆满", eff: { xp: [30, 70], life: [40, 100] } },
    { w: 14, min: 91, max: 99, realm: 9, text: "感应到上界召唤，仙躯愈发凝实", eff: { combat: [0.3, 0.6] } },
    { w: 12, min: 91, max: 99, realm: 9, text: "半步真仙之境，一念可动山河", eff: { xp: [50, 110], combat: [0.2, 0.4] } },
    { w: 10, min: 91, max: 99, realm: 9, text: "巅峰孤寂，一念差点堕入心魔幻境", eff: { life: [-90, -40] } },
    { w: 24, min: 91, max: 99, realm: 9, text: "静坐云台，参悟飞升最后一关", eff: {} }
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
    { id: "a_shici", name: "十世轮回", desc: "累计游玩 10 局", bonus: 0.6, cond: "runs>=10" },
    { id: "a_rival", name: "既生瑜", desc: "一世修为超越同代宿敌", bonus: 0.4, cond: "beatRival" },
    { id: "a_combo", name: "势如破竹", desc: "单局达成 15 连破", bonus: 0.4, cond: "comboBest>=15" },
    { id: "a_daily", name: "天命之人", desc: "完成一次每日同参挑战", bonus: 0.3, cond: "dailyDone" },
    { id: "a_dao", name: "高山流水", desc: "与同代宿敌结为道友", bonus: 0.4, cond: "bondFriend" },
    { id: "a_slain", name: "何生亮", desc: "作为死敌亲手斩落同代宿敌", bonus: 0.6, cond: "slewRival" },
    { id: "a_duel3", name: "踏碎探花台", desc: "隐藏成就：在天下榜正面挑战并击败第三名", bonus: 0.5, cond: "duel3", hidden: true },
    { id: "a_duel2", name: "拽落榜眼冠", desc: "隐藏成就：在天下榜正面挑战并击败第二名", bonus: 0.8, cond: "duel2", hidden: true },
    { id: "a_duel1", name: "掀翻天下第一", desc: "隐藏成就：在天下榜正面挑战并击败榜首", bonus: 1.2, cond: "duel1", hidden: true }
  ];

  /* ---------- 抉择事件：暂停流年，弹出两难选择（risk / reward） ----------
   * opts[].outcomes：p=概率（累加归一，最后一项为兜底），eff 同随机事件，text=结果旁白 */
  var CHOICES = [
    { id: "c_dongfu", min: 5, max: 40, title: "神秘洞府", text: "山腹中发现一座无人洞府，隐有灵光流转，也可能藏有杀机……",
      opts: [
        { label: "闯入探查", tag: "险", outcomes: [
          { p: 0.42, eff: { xp: [10, 26], combat: [0.05, 0.12] }, text: "得上古传承，修为与法宝双收" },
          { p: 0.35, eff: { life: [-14, -5] }, text: "触发禁制，身受重伤狼狈逃出" },
          { p: 0.23, eff: {}, text: "空空如也，只惊起一地尘埃" }
        ] },
        { label: "谨慎离开", tag: "稳", outcomes: [
          { p: 1, eff: { xp: [2, 6] }, text: "不愿涉险，转身离去，心境平和" }
        ] }
      ] },
    { id: "c_dufa", min: 12, max: 70, title: "同道约战", text: "一位同阶修士递来战书，胜者可夺对方半数灵石与一门秘法。",
      opts: [
        { label: "应战", tag: "险", outcomes: [
          { p: 0.5, eff: { combat: [0.1, 0.22], xp: [6, 16] }, text: "险胜！斗法经验与战利品收入囊中" },
          { p: 0.5, eff: { life: [-16, -6], combat: [-0.06, -0.02] }, text: "惜败，负伤而归，颜面稍损" }
        ] },
        { label: "婉拒", tag: "稳", outcomes: [
          { p: 1, eff: {}, text: "拱手谢过，各走各路" }
        ] }
      ] },
    { id: "c_danyao", min: 8, max: 60, title: "禁药诱惑", text: "有人兜售一枚禁忌丹药，据说服之可强行催谷修为，代价是折损寿元。",
      opts: [
        { label: "服下禁药", tag: "险", outcomes: [
          { p: 0.55, eff: { xp: [18, 40], life: [-18, -8] }, text: "药力炸开，修为暴涨，代价是寿元" },
          { p: 0.45, eff: { life: [-30, -14], xp: [-8, -2] }, text: "药性反噬，走火入魔，元气大伤" }
        ] },
        { label: "断然拒绝", tag: "稳", outcomes: [
          { p: 1, eff: { xp: [1, 4] }, text: "道基为本，不为外物所动" }
        ] }
      ] },
    { id: "c_yaoshou", min: 3, max: 45, title: "受困妖兽", text: "一头重伤的高阶妖兽被困于陷阱，救它或取它内丹，皆在一念之间。",
      opts: [
        { label: "出手相救", tag: "善", outcomes: [
          { p: 0.6, eff: { xp: [8, 20], life: [4, 12] }, text: "妖兽感恩，反哺一缕精血与善缘" },
          { p: 0.4, eff: { life: [-10, -3] }, text: "妖兽兽性大发，你险象环生" }
        ] },
        { label: "取其内丹", tag: "利", outcomes: [
          { p: 0.7, eff: { combat: [0.08, 0.18], xp: [4, 12] }, text: "内丹入手，战力与感悟俱增" },
          { p: 0.3, eff: { life: [-14, -5] }, text: "取丹时遭妖兽濒死反扑，受了伤" }
        ] }
      ] },
    { id: "c_miijing", min: 30, max: 90, title: "秘境将启", text: "一处上古秘境即将开启，机缘与陨命各占一半，是否入内一搏？",
      opts: [
        { label: "深入秘境", tag: "险", outcomes: [
          { p: 0.45, eff: { xp: [30, 66], combat: [0.12, 0.28], life: [10, 30] }, text: "夺得核心造化，一步登天" },
          { p: 0.35, eff: { life: [-40, -18] }, text: "遭遇杀阵，重伤遁出" },
          { p: 0.2, eff: {}, text: "秘境凶险，一无所获" }
        ] },
        { label: "外围拾遗", tag: "稳", outcomes: [
          { p: 1, eff: { xp: [10, 24], combat: [0.03, 0.08] }, text: "在外围捡漏，小有收获" }
        ] }
      ] },
    { id: "c_shuangxiu", min: 20, max: 85, title: "双修之邀", text: "一位道侣候选人邀你共修，双修可速进，却也可能道心受扰。",
      opts: [
        { label: "结为道侣", tag: "缘", outcomes: [
          { p: 0.6, eff: { xp: [16, 38], life: [8, 24] }, text: "阴阳相济，修为与寿元双收" },
          { p: 0.4, eff: { xp: [-10, -3], life: [-8, -2] }, text: "情缘成劫，道心蒙尘" }
        ] },
        { label: "潜心独修", tag: "稳", outcomes: [
          { p: 1, eff: { xp: [4, 10] }, text: "斩断尘缘，道心如初" }
        ] }
      ] }
  ];

  /* ---------- 天降机缘（点击接取，考验反应） ----------
   * eff 为接住后的收益；错失会记入「错过机缘」用于结算后悔钩子 */
  var CATCH_ITEMS = [
    { id: "k_lingguo", name: "百年灵果", eff: { life: [6, 14] } },
    { id: "k_lingshi", name: "上品灵石", eff: { xp: [6, 16] } },
    { id: "k_canjuan", name: "功法残卷", eff: { xp: [10, 24] } },
    { id: "k_danyao", name: "延寿丹药", eff: { life: [10, 26] } },
    { id: "k_faobao", name: "无主法宝", eff: { combat: [0.06, 0.16] } },
    { id: "k_xianqi", name: "一缕仙气", eff: { xp: [16, 34], combat: [0.05, 0.12] } }
  ];

  /* ---------- 同代宿敌名号池 ---------- */
  var RIVAL_NAMES = [
    "剑痴·独孤", "丹魔·药尘", "雷子·霄", "影杀·无名", "禅心·一灯",
    "血手·屠苏", "琴仙·清越", "阵狂·八荒", "刀尊·断岳", "花间·醉梦",
    "玄武·镇岳", "天机·观星", "赤霄·燎原", "幽兰·泣露", "狂沙·逐日"
  ];

  /* ---------- 转世遗泽：结算时三选一，作用于下一世 ----------
   * key 由 sim.newRun 解释 */
  var LEGACIES = [
    { id: "jindan_yuwen", name: "金丹余温", desc: "转世携带前世道韵，出生即为 6 级修士", key: "startLvl" },
    { id: "can_hun", name: "残魂护体", desc: "一缕残魂庇佑，寿元上限 +12%", key: "lifeMul" },
    { id: "dao_hen", name: "道痕铭心", desc: "前世道痕未灭，所有正向感悟 ×1.3", key: "daoHen" },
    { id: "xian_gu", name: "仙骨遗蜕", desc: "残留仙骨，最终战力 ×1.15", key: "xianGu" },
    { id: "yuan_chi", name: "缘池未涸", desc: "气运绵长，高阶灵根概率再提升", key: "yuanChi" },
    { id: "fu_yun", name: "福运缠身", desc: "天降机缘出现频率翻倍", key: "fuYun" },
    { id: "ming_huo", name: "命火长明", desc: "本命之火不熄，寿元 +25 年", key: "mingHuo" },
    { id: "su_zhi", name: "夙世悟性", desc: "宿慧未泯，突破概率 ×1.06", key: "suZhi" }
  ];

  /* ---------- 命格词条：每次转世获得一个，作用于下一世 ----------
   * kind：吉 / 凶 / 玄，决定 UI 配色
   * passive：出生时立即生效的固定效果
   * trigger：下一世修仙途中每年有概率随机触发一次 */
  var TRAITS = [
    { id: "t_hongluan", name: "红鸾入命", kind: "吉",
      desc: "桃花气运缠身，出生寿元 +18、魅力 +5；修行中偶尔有故人赠丹。",
      passive: { life: 18, charm: 5 },
      trigger: { p: 0.028, eff: { xp: [8, 18], life: [2, 6] }, text: ["红鸾星动，一位故人踏月而来，赠你一枚温养丹药", "桃花入命，有旧识慕名来访，临别留下一道修炼感悟", "情缘化吉，一句故人赠言让你茅塞顿开"] } },
    { id: "t_jiuzhuan", name: "九转道体", kind: "吉",
      desc: "道基圆融，突破概率 ×1.08；修行途中偶入顿悟之境。",
      passive: { breakMul: 1.08 },
      trigger: { p: 0.02, eff: { xp: [10, 24] }, text: ["九转道体隐有异动，周身灵气自行运转", "道体轰鸣，你在片刻间推演完一门残缺功法", "气走周天，多年滞涩竟在这一刻豁然开朗"] } },
    { id: "t_jian_gu", name: "天生剑骨", kind: "吉",
      desc: "骨中藏锋，战力 ×1.07；偶尔剑气淬体，杀伐更盛。",
      passive: { combatMul: 1.07 },
      trigger: { p: 0.024, eff: { combat: [0.03, 0.08] }, text: ["剑骨铮鸣，一缕无形剑气在你经脉中淬炼", "并指为剑，你凭空悟出一道杀伐剑意", "剑心通明，战斗本能悄然攀升"] } },
    { id: "t_changsheng", name: "长寿仙苗", kind: "吉",
      desc: "命格厚重，出生寿元 +40；常年有灵物自发为你温养肉身。",
      passive: { life: 40 },
      trigger: { p: 0.022, eff: { life: [3, 10] }, text: ["你体内的长寿仙根吐纳灵气，气血愈发充盈", "一株无名灵草在洞府外破土，散出丝丝生机", "岁月之力似乎格外眷顾你，寿元略有增长"] } },
    { id: "t_meiyun", name: "霉运缠身", kind: "凶",
      desc: "运道晦暗，战力 ×0.94；修行路上偶尔平地摔跟头。",
      passive: { combatMul: 0.94 },
      trigger: { p: 0.03, eff: { xp: [-12, -4], life: [-6, -2] }, text: ["你误入一处废弃禁制，灵气紊乱，狼狈脱身", "炼丹时炉火失控，损失了不少天材地宝", "一场无妄之灾找上门来，耽误了修行"] } },
    { id: "t_zaoyao", name: "早夭之兆", kind: "凶",
      desc: "命火偏弱，出生寿元 -18；每年偶尔气血逆涌。",
      passive: { life: -18 },
      trigger: { p: 0.026, eff: { life: [-9, -3] }, text: ["命火无端摇曳，你只觉一阵心悸", "旧伤突然复发，气血翻涌", "天机蒙尘，一股死气在你经脉中一闪而逝"] } },
    { id: "t_xinmo", name: "心魔深种", kind: "凶",
      desc: "执念随轮回而来，突破概率 ×0.95；修行途中易被杂念反噬。",
      passive: { breakMul: 0.95 },
      trigger: { p: 0.03, eff: { xp: [-14, -6] }, text: ["心魔在耳边低语，你的道心出现裂痕", "前世执念翻涌，你被困在幻境半日", "杂念如潮，硬生生打断了你的顿悟"] } },
    { id: "t_caiqi", name: "财气逼人", kind: "玄",
      desc: "偏财运极盛，偶尔捡到宝贝；但树大招风，也会招来觊觎。",
      passive: { charm: 6 },
      trigger: { p: 0.026, eff: { xp: [8, 20], combat: [0.02, 0.06] }, text: ["你在旧物堆里翻出一件蒙尘宝贝", "一位商人死活要把一块奇石低价让给你", "天降横财，你捡到了一小袋灵珠"] } },
    { id: "t_gusha", name: "天煞孤星", kind: "凶",
      desc: "煞气入命，战力 ×1.05，但常被天煞反噬；一生多磨。",
      passive: { combatMul: 1.05, life: -12 },
      trigger: { p: 0.028, eff: { life: [-8, -3], combat: [0.02, 0.05] }, text: ["天煞之气反噬，你咳出一口逆血，却也激出几分狠劲", "孤星入命，你在杀局中负伤，战意却不减反增", "煞气与战意纠缠，你伤身而不伤胆"] } },
    { id: "t_ziqi", name: "紫气东来", kind: "吉",
      desc: "贵不可言，出生魅力 +12；修行中偶得高人青眼。",
      passive: { charm: 12, life: 8 },
      trigger: { p: 0.022, eff: { xp: [10, 22], combat: [0.02, 0.05] }, text: ["紫气东来，一位路过的散修停下来指点你", "贵气隐现，宗门长辈对你格外和颜悦色", "你于山巅观日，悟得一丝皇道气象"] } },
    { id: "t_tiekou", name: "铁口直断", kind: "玄",
      desc: "言出法随，福祸相倚；随机事件的效果被略微放大。",
      passive: { xpMul: 1.12 },
      trigger: { p: 0.025, eff: { xp: [-8, 20] }, text: ["你随口一句断言，竟牵动了一丝因果", "一语成谶，今日的际遇格外跌宕", "你窥见命数一角，却也因此沾染因果"] } },
    { id: "t_baiwu", name: "百无禁忌", kind: "吉",
      desc: "心无挂碍，出生寿元 +22、魅力 +8；修行路走得更稳。",
      passive: { life: 22, charm: 8, breakMul: 1.03 },
      trigger: { p: 0.018, eff: { xp: [6, 16], life: [2, 6] }, text: ["你随性而行，反而暗合天道", "无拘无束，灵气运转格外顺畅", "一场说走就走的远游，让你心境大开"] } },
    { id: "t_lingtai", name: "灵台蒙尘", kind: "凶",
      desc: "前世创伤未愈，出生感悟 -12；偶尔灵台昏沉，修行停滞。",
      passive: { cultBonus: -12, life: -6 },
      trigger: { p: 0.03, eff: { xp: [-16, -8] }, text: ["灵台蒙尘，你看什么都隔着一层雾", "旧日道伤发作，你被迫停下修炼", "神思恍惚，一日苦修几乎白费"] } },
    { id: "t_xian_gen", name: "仙根残片", kind: "玄",
      desc: "体内埋着一枚残缺仙根，出生即为 3 级；偶尔引出仙灵之气。",
      passive: { startLvl: 3, life: 10 },
      trigger: { p: 0.02, eff: { xp: [12, 28] }, text: ["残破仙根微微发亮，渡来一缕仙灵之气", "仙根残片与你的灵根共鸣，修行如有神助", "你梦见一段残缺仙法，醒来竟真有所得"] } },
    { id: "t_xiuluo", name: "修罗战血", kind: "吉",
      desc: "越战越勇，战力 ×1.06；每逢杀伐，战意更盛。",
      passive: { combatMul: 1.06 },
      trigger: { p: 0.024, eff: { combat: [0.03, 0.07] }, text: ["修罗战血沸腾，你的杀伐本能更进一层", "你以战养战，斗法经验飞快积累", "血腥气让你心跳加速，战意陡然攀升"] } },
    { id: "t_wulou", name: "无漏之体", kind: "吉",
      desc: "精气不泄，出生寿元 +30；偶尔自愈暗伤。",
      passive: { life: 30 },
      trigger: { p: 0.022, eff: { life: [4, 10] }, text: ["无漏之体自行修复暗伤，气血回升", "你闭关数日，体内沉疴尽去", "精气完足，肉身越发坚韧"] } },
    { id: "t_yaodu", name: "药毒之体", kind: "凶",
      desc: "百毒侵体，寿命受损；但偶尔以毒攻毒，战力反而小涨。",
      passive: { life: -15 },
      trigger: { p: 0.026, eff: { life: [-10, -4], combat: [0.02, 0.05] }, text: ["药毒发作，你浑身冰冷，却意外淬炼出一丝战意", "体内余毒翻涌，你以痛意磨砺肉身", "旧毒爆发，你强撑过去，气息反而凌厉了几分"] } },
    { id: "t_tianxuan", name: "天选之子", kind: "吉",
      desc: "气运加身，突破概率 ×1.12；偶尔得到天道垂青。",
      passive: { breakMul: 1.12, charm: 8 },
      trigger: { p: 0.02, eff: { xp: [12, 28] }, text: ["天道垂青，你感到瓶颈松动了些", "冥冥中似有气运向你汇聚", "你抬头望天，刹那间与某种大势产生共鸣"] } },
    { id: "t_fangu", name: "天命反骨", kind: "凶",
      desc: "不服天命，突破概率 ×0.93，但战力 ×1.05；与天争命，凶中藏锐。",
      passive: { breakMul: 0.93, combatMul: 1.05 },
      trigger: { p: 0.028, eff: { xp: [-12, -4], combat: [0.02, 0.06] }, text: ["天命反骨发作，你偏要逆势而行，虽伤亦强", "逆天之路艰难，你被反噬，却不肯低头", "你与命数相争，落得满身是伤，战意却愈发锋锐"] } },
    { id: "t_nifeng", name: "泥丸封窍", kind: "凶",
      desc: "先天灵窍闭塞，出生感悟 -8；修行中偶尔白费苦功。",
      passive: { cultBonus: -8, life: -8 },
      trigger: { p: 0.03, eff: { xp: [-18, -8] }, text: ["泥丸宫闭塞，你苦修一日却收获寥寥", "灵窍不通，你引气时屡屡碰壁", "天资蒙昧，让你在瓶颈前多耗了许多年月"] } }
  ];

  /* ---------- 法宝装备：修仙途中随机掉落，结算时可选择带入下一世 ----------
   * charm 为魅力值，eff 为出生时应用的效果；combatMul/breakMul/xpMul 为被动倍率 */
  var EQUIPMENT = [
    { id: "e_chuan_guo_yu_xi", name: "传国玉玺", icon: "👑", rarity: "仙品",
      desc: "降世时抱在怀中，紫微帝气护体；魅力 +20，战力与气运皆有增益。",
      charm: 20, combatMul: 1.04, eff: { life: [6, 14] } },
    { id: "e_qing_ping_jian", name: "青萍剑", icon: "🗡", rarity: "灵宝",
      desc: "古剑轻鸣，锋锐无匹；出生自带剑意，战力大幅提升。",
      combatMul: 1.08, eff: { combat: [0.08, 0.16] } },
    { id: "e_huxin_jing", name: "九转护心镜", icon: "🛡", rarity: "灵宝",
      desc: "宝镜护体，百邪不侵；出生寿元更厚。",
      eff: { life: [14, 28] } },
    { id: "e_juling_zhu", name: "聚灵珠", icon: "🔮", rarity: "灵器",
      desc: "天地灵气自发汇聚，出生感悟大增。",
      eff: { xp: [10, 22] } },
    { id: "e_baicao_dai", name: "百草袋", icon: "🌿", rarity: "灵器",
      desc: "内有灵草百株，出生寿元略增，药香温养肉身。",
      charm: 4, eff: { life: [8, 16] } },
    { id: "e_pojun_qi", name: "破军战旗", icon: "🚩", rarity: "宝器",
      desc: "战旗猎猎，煞气冲天；出生战力提升，气势摄人。",
      charm: 5, combatMul: 1.04, eff: { combat: [0.04, 0.08] } },
    { id: "e_feiyun_xue", name: "飞云履", icon: "🥾", rarity: "灵器",
      desc: "踏云而行，身法飘逸；魅力提升，机缘也更愿亲近。",
      charm: 10, eff: { combat: [0.02, 0.05] } },
    { id: "e_zhenhun_ling", name: "镇魂铃", icon: "🔔", rarity: "灵器",
      desc: "铃声安神，护住灵台；出生寿元与魅力皆有增益。",
      charm: 6, eff: { life: [6, 14] } },
    { id: "e_tuntian_wan", name: "吞天碗", icon: "🥣", rarity: "异宝",
      desc: "碗中自成天地，吞噬灵气反哺自身；感悟增益，但略有风险。",
      xpMul: 1.08, eff: { xp: [8, 18], life: [-6, -2] } },
    { id: "e_jiu_luopan", name: "旧罗盘", icon: "🧭", rarity: "宝器",
      desc: "能窥见一丝命数，出生魅力 +4、突破概率 ×1.04。",
      charm: 4, breakMul: 1.04 }
  ];

  /* ---------- 弹幕氛围池（营造热闹感） ---------- */
  var DANMAKU = [
    "前排围观大佬渡劫", "这一世稳了", "笑死，又是杂灵根", "天灵根！羡慕了",
    "坐等飞升", "这宿敌有点东西", "连破好爽", "怎么又暴毙了", "苟住别浪",
    "接住机缘啊！", "渡劫加油！", "我上我也行", "非酋落泪", "欧皇附体",
    "这波血赚", "寿元不够用了", "再来亿把", "见证历史",
    "群里都说这把必飞升", "微信已经炸了，就等你飞升截图", "别怂，跟宿敌拼了",
    "我这把资质拉满，谁懂", "又卡在瓶颈，道心碎了", "机缘从我指尖溜走了……",
    "弹幕护体！渡劫必过", "楼上渡劫的加油，全群看着呢", "这战力放群里能排第几？",
    "默默记下这世的教训", "天道不公啊！！", "稳住，我们能赢", "一把梭哈，直接冲99",
    "道友留步，加个微信", "飞升的那一刻我哭了", "这宿敌名字怎么这么眼熟",
    "今日天命加持，冲！", "放话已发，群里见", "榜一那位，我给你下了战书",
    "长寿才是王道，战力浮云", "天资榜有我一名，知足", "修为榜冲鸭",
    "别卷了别卷了，肝疼", "这游戏有毒，停不下来", "又一世白费，但我爱"
  ];

  /* ---------- 今日天命（每日全服同一卦象，日期种子） ---------- */
  var DAILY_FATE = [
    { name: "剑修之日", icon: "⚔", mult: 1.15, desc: "剑气纵横，今日战力 ×1.15，宜正面硬刚宿敌" },
    { name: "丹修之日", icon: "🔥", mult: 1.10, desc: "丹香四溢，今日战力 ×1.10，宜稳扎稳打炼丹" },
    { name: "雷劫之日", icon: "⚡", mult: 1.20, desc: "天雷滚滚，今日战力 ×1.20，渡劫风险与机缘并存" },
    { name: "长生之日", icon: "🕯", mult: 1.05, desc: "岁月静好，今日战力 ×1.05，宜苟活攒寿元" },
    { name: "机缘之日", icon: "🎁", mult: 1.10, desc: "天降横财，今日战力 ×1.10，手速决定一切" },
    { name: "心魔之日", icon: "🌫", mult: 1.25, desc: "魔念丛生，今日战力 ×1.25，高风险高回报" },
    { name: "无为之日", icon: "☯", mult: 0.95, desc: "清静无为，今日战力 ×0.95，但道心最稳" },
    { name: "群仙之日", icon: "🌈", mult: 1.18, desc: "众仙庇佑，今日战力 ×1.18，宜结伴放话" },
    { name: "杀伐之日", icon: "💥", mult: 1.22, desc: "杀意凛然，今日战力 ×1.22，宜下战书了断恩仇" },
    { name: "平淡之日", icon: "🍵", mult: 1.00, desc: "无事发生，今日战力 ×1.00，喝口茶慢慢修" }
  ];

  /* ---------- 交互型小游戏文案池（多变体，减少重复，保持新鲜感） ----------
   * 用 {占位符} 标记动态内容，game.js 里通过 qte(group,key,map,fallback) 随机取一条并填充 */
  var QTE_LINES = {
    awaken: {
      btn: ["按住蓄力", "凝神引气", "催动灵根", "吐纳聚灵"],
      result: [
        "先天灵根觉醒，资质 <b>{apt}</b>（{aptTitle}）<br>命定寿元 {life} 年 · 同代宿敌「{rival}」已睁眼",
        "天地灵气灌体，你觉醒「{root}」，资质 <b>{apt}</b>（{aptTitle}）<br>此身可修 {life} 年，而「{rival}」正与你争这一世气运",
        "灵光冲霄！「{root}」现世，资质 <b>{apt}</b>（{aptTitle}）<br>寿元 {life} 年，宿敌「{rival}」已在暗中较劲",
        "命星高照，你觉醒「{root}」，资质 <b>{apt}</b>（{aptTitle}）<br>可活 {life} 年 · 冥冥中「{rival}」与你结下累世之缘"
      ]
    },
    trib: {
      info: [
        "资质 {apt}，天劫每秒侵蚀 {drain}%——狂点抗劫，把进度拉满即飞升！",
        "九重天雷压下，每秒吞噬 {drain}% 道行——手不能停，拉满即渡劫飞升！",
        "劫云翻涌，天威锁死气机，每秒侵蚀 {drain}%——疯狂点击，撑过去就是仙！",
        "天雷如雨，道行每秒流逝 {drain}%——咬牙狂点，一线仙机就在眼前！"
      ],
      infoXY: [
        "仙缘「{xy}」护体，天劫侵蚀减半——顶住这波，白日飞升！",
        "有「{xy}」在侧护道，劫威大减——稳住进度条，飞升在即！",
        "仙缘「{xy}」为你挡下大半天威——狂点抗劫，一步登天！",
        "「{xy}」引仙台在前，劫数已轻——全力点击，登仙只在此刻！"
      ]
    },
    demon: {
      info: [
        "道心蒙尘！狂点凝神，驱散心魔！",
        "心魔滋生，杂念如潮——猛点凝神守住灵台！",
        "旧日执念化作心魔袭来——点击凝神，斩断妄念！",
        "幻境丛生，心魔乱道——狂点凝神魂，稳住！"
      ],
      win: [
        "🧘 道心重归清明，一念顿悟，因祸得福{ap}",
        "🧘 心魔溃散，你于杂念中窥见真我，道行精进{ap}",
        "🧘 斩却心魔，灵台澄澈，反手收获一场造化{ap}",
        "🧘 妄念尽消，道心如初，劫后反得一场大机缘{ap}"
      ],
      lose: [
        "👿 心魔蚀体，气血翻涌，你几乎走火入魔（寿元 -{loss}）",
        "👿 杂念如潮，道心蒙尘，一口逆血喷出（寿元 -{loss}）",
        "👿 心魔得逞，你被拖入幻境，醒来寿元已损（-{loss}）",
        "👿 一念之差坠入魔障，元神受创（寿元 -{loss}）"
      ]
    },
    catch: {
      info: [
        "「{item}」化作流光坠落——手快有，手慢无！",
        "天降「{item}」，灵光直坠你面前——抓住它！",
        "一道机缘「{item}」破空而来——眼疾手快，接！",
        "「{item}」自九天洒落，机缘稍纵即逝——快接！"
      ],
      win: [
        "接住了！「{item}」稳稳入手{ap}",
        "手到擒来！「{item}」收入囊中{ap}",
        "机缘归你！「{item}」化作精纯灵力{ap}",
        "眼疾手快，「{item}」被你一把攥住{ap}"
      ],
      lose: [
        "手慢了…「{item}」从指缝溜走，消散于天地",
        "差之毫厘！「{item}」擦身而过，化为乌有",
        "反应慢了半拍，「{item}」坠地即碎，无缘得见",
        "指尖堪堪掠过，「{item}」却化作流光散去……"
      ]
    },
    bond: {
      intro: [
        "狭路相逢！同代宿敌「<b>{name}</b>」拦在你面前，目光灼灼——是化敌为友，还是不死不休？",
        "冤家路窄！宿敌「<b>{name}</b>」负手立于山道，气机锁定你——结盟，还是决一死战？",
        "命中宿敌「<b>{name}</b>」现身，剑拔弩张——一念为友，一念为敌，你如何抉择？",
        "「<b>{name}</b>」踏云而来，与你四目相对，杀意与敬意交织——何去何从？"
      ],
      friend: [
        "🤝 你与「{name}」义结金兰，自此论道同行、渡劫护道{ap}",
        "🤝 与「{name}」把酒言欢，结为道友，往后修行有人并肩{ap}",
        "🤝 你二人歃血为盟，「{name}」从此是你的同道挚友{ap}",
        "🤝 一笑泯恩仇，你与「{name}」携手同修，道途不再孤身{ap}"
      ],
      enemy: [
        "⚔️ 你与「{name}」立下死誓，不死不休！被他压制反而激发你的凶性{ac}",
        "⚔️ 与「{name}」彻底决裂，血仇深种，恨意化作你精进的动力{ac}",
        "⚔️ 你向「{name}」下达战书，此生不共戴天，越战越勇{ac}",
        "⚔️ 死敌既定！「{name}」的存在逼出你骨子里的杀伐之意{ac}"
      ],
      neutral: [
        "😐 你与「{name}」相视一笑，各修各道，两不相欠",
        "😐 与「{name}」拱手作别，井水不犯河水，各奔前程",
        "😐 你二人擦肩而过，恩怨随风，从此陌路",
        "😐 「{name}」与你点头致意，不结盟也不为敌，江湖再见"
      ]
    }
  };

  /* ---------- 机器人榜（填充排行榜，营造竞争感） ---------- */
  var BOTS = [
    { name: "青云子", lvl: 63, combat: 182000 },
    { name: "无名散修", lvl: 47, combat: 96000 },
    { name: "丹塔主", lvl: 71, combat: 240000 },
    { name: "剑十三", lvl: 88, combat: 512000 },
    { name: "小师妹", lvl: 34, combat: 51000 },
    { name: "老怪物", lvl: 95, combat: 730000 },
    { name: "路人甲", lvl: 22, combat: 18000 },
    { name: "渡劫失败者", lvl: 99, combat: 900000 },
    { name: "咸鱼翻身", lvl: 55, combat: 140000 },
    { name: "天选之人", lvl: 99, combat: 1500000, ascend: true }
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
    CHOICES: CHOICES, CATCH_ITEMS: CATCH_ITEMS, RIVAL_NAMES: RIVAL_NAMES,
    LEGACIES: LEGACIES, DANMAKU: DANMAKU, BOTS: BOTS, DAILY_FATE: DAILY_FATE,
    TRAITS: TRAITS, EQUIPMENT: EQUIPMENT, QTE_LINES: QTE_LINES,
    expNeed: expNeed, runTitle: runTitle
  };

  root.DATA = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})(typeof self !== "undefined" ? self : this);
