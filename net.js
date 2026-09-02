/* ============================================================
 * 修仙模拟器 · 联网排行榜适配器（Supabase / PostgREST，纯 fetch，无 SDK）
 * ------------------------------------------------------------
 * 开启联网「天下榜」只需两步：
 *   1) 在 Supabase 建一张 scores 表（建表 SQL 见 README/项目说明）。
 *   2) 把下面 NET_CONFIG.url 和 NET_CONFIG.anonKey 填成你自己项目的值。
 * 两项留空时，Net.enabled() 返回 false，游戏自动回退到本地仙榜，
 * 不会有任何报错或联网请求——纯静态托管也能照常玩。
 * ============================================================ */
window.NET_CONFIG = {
  url: "https://olgsyohnlwamsazlvkhk.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sZ3N5b2hubHdhbXNhemx2a2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMTczMDgsImV4cCI6MjEwMzg5MzMwOH0.S5DAla0YWOIPKyD1SSTYzQWFqdN5MWy-dhP9xTLJCUk"
};

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Net = factory();
})(typeof self !== "undefined" ? self : this, function () {

  function cfg() {
    return (typeof window !== "undefined" && window.NET_CONFIG) || { url: "", anonKey: "" };
  }
  function enabled() {
    var c = cfg();
    return !!(c.url && c.anonKey && /^https?:\/\//.test(c.url));
  }
  function base() { return cfg().url.replace(/\/+$/, ""); }
  function headers(extra) {
    var c = cfg();
    var h = { "apikey": c.anonKey, "Authorization": "Bearer " + c.anonKey, "Content-Type": "application/json" };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    return h;
  }
  /* 昵称清洗：去空白、限长 12、过滤尖括号防注入，空则给默认 */
  function cleanNick(s) {
    s = String(s == null ? "" : s).replace(/[<>]/g, "").trim().slice(0, 12);
    return s || "无名散修";
  }
  /* 上报一局战绩 */
  function submit(entry) {
    if (!enabled()) return Promise.reject(new Error("net-disabled"));
    var row = {
      nickname: cleanNick(entry.nickname),
      root: String(entry.root || "").slice(0, 20),
      apt: Math.max(1, Math.min(10, entry.apt | 0)),
      lvl: Math.max(1, Math.min(99, entry.lvl | 0)),
      realm: String(entry.realm || "").slice(0, 12),
      combat: Math.max(0, Math.round(entry.combat || 0)),
      age: Math.max(0, entry.age | 0),
      ascend: !!entry.ascend,
      bond: (entry.bond === "friend" || entry.bond === "enemy") ? entry.bond : "none",
      seed: String(entry.seed || "").slice(0, 16)
    };
    return fetch(base() + "/rest/v1/scores", {
      method: "POST", headers: headers({ "Prefer": "return=minimal" }), body: JSON.stringify(row)
    }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return true;
    });
  }
  /* 拉取天下榜（按战力降序） */
  function top(limit) {
    limit = Math.max(1, Math.min(100, limit || 50));
    if (!enabled()) return Promise.reject(new Error("net-disabled"));
    var q = "/rest/v1/scores?select=nickname,root,apt,lvl,realm,combat,age,ascend,bond,created_at" +
            "&order=combat.desc&limit=" + limit;
    return fetch(base() + q, { headers: headers() }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }

  return { enabled: enabled, submit: submit, top: top, cleanNick: cleanNick, config: cfg };
});
