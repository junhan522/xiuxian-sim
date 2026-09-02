# 联网「天下榜」配置指南（Supabase + GitHub Pages）

GitHub Pages 是纯静态托管，没有服务器和数据库，所以联网排行榜需要外接一个免费的数据服务。
本项目用的是 **Supabase**（免费的云 Postgres + 自动生成的 REST 接口），网页前端用 `fetch` 直接读写，
不需要任何后端代码，也不需要打包构建——非常适合静态托管。

代码已经写好并做了**降级保护**：只要你没在 `net.js` 里填凭据，游戏就完全走本地仙榜，不联网、不报错。
填了凭据，「🌐 天下榜」和结算页的「上传天下榜」就自动生效。

---

## 一、建表 SQL（复制即用）

在 Supabase 控制台左侧 **SQL Editor → New query**，粘贴下面全部内容，点 **Run**：

```sql
-- 战绩表
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  nickname   text    not null default '无名散修',
  root       text,                       -- 灵根
  apt        int,                        -- 资质 1~10
  lvl        int,                        -- 等级 1~99
  realm      text,                       -- 境界名
  combat     bigint  not null default 0, -- 最终战力（排序依据）
  age        int,                        -- 享年
  ascend     boolean default false,      -- 是否飞升
  bond       text    default 'none',     -- 宿敌羁绊：none / friend / enemy
  seed       text,                       -- 命格种子（便于复盘/防刷校验）
  created_at timestamptz not null default now()
);

-- 按战力降序取前 N 的索引
create index if not exists scores_combat_idx on public.scores (combat desc);

-- 轻量防滥用约束
alter table public.scores add constraint scores_nick_len   check (char_length(nickname) between 1 and 12);
alter table public.scores add constraint scores_combat_rng check (combat >= 0 and combat < 1000000000000000);
alter table public.scores add constraint scores_lvl_rng    check (lvl between 1 and 99);

-- 开启行级安全（RLS）
alter table public.scores enable row level security;

-- 允许任何人上传战绩（匿名可写）
create policy "anyone_can_insert_scores"
  on public.scores for insert
  to anon, authenticated
  with check (true);

-- 允许任何人查看榜单（匿名可读）
create policy "anyone_can_read_scores"
  on public.scores for select
  to anon, authenticated
  using (true);
```

> 说明：这里**只**开放了 `insert` 和 `select`，没有开放 `update` / `delete`。
> 所以即使 `anonKey` 是公开的（前端可见，这是正常且必须的），别人最多只能往榜里写分或读榜，
> **无法删除或篡改表结构、也无法删你的数据**。

---

## 二、拿到凭据并填入 net.js

> 本仓库的 `net.js` **已经**填好线上项目（`olgsyohnlwamsazlvkhk`）的 url 与 anonKey，
> 建表 SQL 也已在该项目执行完毕，开箱即用。下面步骤仅当你想把游戏接到**自己的** Supabase 项目时才需要。

1. 注册 / 登录 [supabase.com](https://supabase.com)，**New Project**。
   - 面向国内玩家，Region 建议选 **Southeast Asia (Singapore)**，延迟相对友好。
   - 数据库密码随便设一个强密码并保管好（本方案用不到它，但别丢）。
2. 建好项目后，先执行上面「一、建表 SQL」。
3. 左侧 **Settings（齿轮）→ API**，复制两样东西：
   - **Project URL**，形如 `https://abcdefgh.supabase.co`
   - **Project API keys** 里的 **`anon` `public`** 那把（很长一串 `eyJ...`）
4. 打开仓库里的 `net.js`，把顶部填上：

```js
window.NET_CONFIG = {
  url: "https://abcdefgh.supabase.co",   // ← 换成你的 Project URL
  anonKey: "eyJhbGci....(你的 anon key)"   // ← 换成你的 anon public key
};
```

5. `git commit` + `git push`，等 GitHub Pages 生效（约 1 分钟）即可。
   游戏内 **⚙ 设置** 会显示「联网榜已连接」，**🏆 仙榜 → 🌐 天下榜** 就能看到全网排名。

---

## 三、关于防作弊（按需，可先不做）

前端上报分数，理论上有人能改分。休闲小游戏通常可接受。若以后想更严格，有两条升级路径：

- **服务端校验**：写一个 Supabase Edge Function，用上报的 `seed` 在云端重放命格、核对战力上限后再入库；
  前端改为调用该函数而不是直接 insert。
- **频率/去重限制**：给 `insert` 策略加 `with check`，或用数据库触发器限制同一昵称的写入频率。

当前版本已内置：昵称长度 ≤12、尖括号过滤（防 HTML 注入）、战力/等级范围约束。

---

## 四、本地测试（不填凭据也能验证降级）

直接打开 `index.html`：
- 不填 `net.js` 凭据时，🌐 天下榜显示「尚未配置」，结算页上传按钮提示未配置，本地仙榜照常工作。
- 填入凭据后，上传一局 → 到天下榜即可看到自己的昵称与战力。
