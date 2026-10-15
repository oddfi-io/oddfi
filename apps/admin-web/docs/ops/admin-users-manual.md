# 运营手册 · 管理员权限管理

> 涵盖:**给同事开权限 / 改角色 / 收回权限** 的完整流程。
> 入口:`https://admin.oddfi.io` → 登录后侧栏「管理员管理」(super_admin only)。
> 相关:`.claude/rules/rbac.md`(4 角色矩阵真值源)、`.claude/rules/lark-oauth.md`(登录流程)、`docs/ops/deploy-runbook.md`(部署/回滚)。

---

## 0. 一句话流程

```
同事进 OddFi Lark 工作区
  ↓
super_admin 拿到同事的 lark_user_id（open_id, "ou_xxx" 格式）
  ↓
super_admin 在「管理员管理 → 新建」填字段 + 选角色 → 创建
  ↓
同事访问 admin.oddfi.io → Lark 授权 → 自动落地 Dashboard，菜单按角色显隐
```

总耗时:< 2 分钟(假设已知 lark_user_id)。

---

## 1. 角色矩阵(简版,详见 rbac.md)

| 角色 | 用途 | 能看 | 能改 |
|---|---|---|---|
| `super_admin` | 超管 / 技术负责 | 全部 7 模块 | 全部,**含管理员管理本身** |
| `operator` | 业务运营 | 总览/轮次/入账/异常/配置/审计 | 轮次状态机操作(pause/resume/close 等)、deposits migrate-round、anomaly resolve;**不能**改配置/改轮次字段/改管理员 |
| `customer_service` | 客服 | 总览/轮次/入账/异常/配置/审计 | **仅 anomaly resolve**(其余只读) |
| `finance` | 财务(本期暂未启用预售权限) | 落 `本期无可用模块` 空态页 | — |

> ⚠️ 改矩阵需同步改:`rbac.md` 表格 + `src/lib/rbac.ts` + 后端 `RoleRequired` 中间件 + 本文件。

---

## 2. 添加新管理员

### 2.1 前置

- [ ] 同事**已在 OddFi Lark 工作区**(`open.larksuite.com`,国际版 — 不是 `feishu.cn` 国内版)
- [ ] 你是 super_admin(否则在 admin SPA 看不到「管理员管理」菜单)
- [ ] **(只做一次,已就绪可跳过)** admin-backend 的 Lark app 已配齐**三层** visibility(不是一层!):

  | # | 配置项 | 决定 | 配置位置 |
  |---|---|---|---|
  | 1 | **OAuth scope** `contact:user.id:readonly`(应用身份) | app 能调哪些 API | `https://open.larksuite.com/app/<LARK_APP_ID>/access` 「权限管理」 |
  | 2 | **数据权限范围 / 通讯录可见范围**=全员 | API 能读到哪些用户(否则查 ID 返 NOT_FOUND) | 同上「权限管理」→ 每条权限的「可访问的数据范围 配置」 |
  | 3 | **应用可用范围**=全员可用 或 包含目标同事 | 哪些用户能**登录/使用** app(否则 Lark 授权页报"你没有 xxx 的使用权限") | **`https://admin.larksuite.com` 工作台 → 应用管理 → oddfi-admin → 应用可用范围 → 配置**(开发者控制台 `version` 那边也能改,但 admin 后台这里 UI 更直接) |

  **三个独立配置,缺一不可**;改完**立即生效**(无需重新发版),但**对正在登录中的同事可能有 Lark 端缓存**——让对方**用无痕窗口重登**最稳。

### 2.2 拿同事的 open_id

**一行命令**:

```bash
cd ~/work/oddfi-admin-frontend
./scripts/lark-openid.sh colleague@oddfi.com
# → colleague@oddfi.com -> ou_xxxxxxxxxxxxxxxx
```

支持批量和手机号:
```bash
./scripts/lark-openid.sh a@x.com b@y.com c@z.com       # 批量(单次最多 50)
./scripts/lark-openid.sh -m +8613800138000             # 中国大陆手机
./scripts/lark-openid.sh -m +6587706306                # 新加坡 +65 + 8 位
./scripts/lark-openid.sh -h                            # 完整用法
```

**手机号格式约束(踩过的坑)**:
- 必须 **E.164 格式**:`+` 开头 + 国家码 + 纯本地号码(无空格、无破折号)
- 国家码后的本地号**严格按运营商分配位数**:中国 11 位、新加坡 8 位、美国 10 位等
- 多余的前导 `0` 必须去掉(实测 `+65087706306` → NOT_FOUND;`+6587706306` → 命中)

脚本自己从 `~/work/oddfi-admin-backend/{.env.local, config.yaml}` 取凭据(app_secret / app_id),你不用碰任何 secret。

#### NOT_FOUND 排查

| 现象 | 原因 | 修 |
|---|---|---|
| Lark 客户端里**确实**找不到这个人 | 没加入工作区 | Lark admin 先把人拉进 OddFi 工作区 |
| Lark 里有,API 仍 NOT_FOUND | app 数据权限范围限制 | §2.1 第 3 条:把「通讯录可见范围」改成「全员」(改完立即生效) |
| 邮箱可能不是 Lark 注册邮箱 | Lark 用了另一邮箱/手机号 | 换邮箱试,或 `-m +86138...` 试手机号 |
| 脚本报 `ADMIN_LARK_APP_ID 未设置` | `config.yaml` 不在默认位置 | `ADMIN_BACKEND_CONFIG=/path/to/config.yaml ./scripts/lark-openid.sh ...` |

> ID 必须是 **`ou_` 开头**(open_id);如果意外拿到 `on_`(union_id)或别的开头,说明 `user_id_type` 参数错了,脚本默认 open_id,正常不会踩。

### 2.3 在前端添加

1. 登录 `admin.oddfi.io`(super_admin)
2. 侧栏「管理员管理」→ 右上「新建」
3. 表单填:

| 字段 | 必填 | 示例 | 说明 |
|---|---|---|---|
| Lark User ID | ✅ | `ou_12d3776bcf5f20c5289d3cd0767aade1` | open_id,以 `ou_` 开头 |
| Lark Name | ✅ | `张三` | 显示用,任意填 |
| Lark Email | 可选 | `zhangsan@oddfi.com` | 审计追溯用 |
| Lark Avatar | 可选 | URL | 通常留空 |
| Role | ✅ | `operator` | 4 选 1,选错可改 |

4. 「确认」→ 后端创建,列表立刻刷新出现这一行
5. 通知同事可以登录了

### 2.4 失败排查

| 错误码 / 现象 | 含义 | 处理 |
|---|---|---|
| `ADMIN_USER_EXISTS` (400) | 该 lark_user_id 已被加 | 列表里搜一下,改他角色而不是重新加 |
| `INVALID_PARAM` (400) | 缺必填或格式错(常见:Lark User ID 不以 `ou_` 开头) | 核对 open_id 来源 |
| `INSUFFICIENT_ROLE` (403) | 你不是 super_admin | 让现有 super_admin 操作 |

---

## 3. 改角色

侧栏「管理员管理」→ 找到这一行 → 角色那列点「角色 Select」→ 选新角色 → 弹出二次确认 modal:
- **升级**(operator → super_admin):info 提示
- **降级**(super_admin → operator):**红色 danger** 模态提醒
- 「确认执行」→ 立刻生效

### 注意

- **降级即时生效**,被改的同事如果正在操作,下次点击会被前端 `RoleGuard` 隐藏按钮 / 后端 `RoleRequired` 返 403
- 末位 super_admin **不能降级**(前端 Select disabled + 后端兜底返 `LAST_SUPER_ADMIN` 400)
- 自己改自己角色:前端会拦,后端兜底 `INVALID_PARAM`

---

## 4. 收回权限(同事离职 / 调岗)

侧栏「管理员管理」→ 找到这一行 → 行尾「删除」按钮 → ConfirmMutationModal(danger,要求 note≥10 字符,典型 note:`同事 XX 调岗,收回 admin 权限`)→ 「确认执行」。

### 失效时效

- 列表立刻消失
- 同事**当前持有的 JWT 仍可用直到 exp(8h)**——这是 stateless JWT 的代价
- 想立刻撕掉 token:让同事登一次 `/auth/logout`(把 jti 写进黑名单),或后端运维直接刷新 jti 黑名单表
- 拒绝时显示的错误码:
  - `CANNOT_REMOVE_SELF`(400):不能删自己(必须由其他 super_admin 删)
  - `LAST_SUPER_ADMIN`(400):删最后一个 super_admin(必须先升级别人)

### 离职完整 checklist

- [ ] 「管理员管理」删除该 admin_user 行
- [ ] (可选)让同事或 IT 在 Lark 开放平台撤回 OddFi 后台 app 的授权
- [ ] (可选)运维登 EC2,把这个 user 的所有未过期 jti 加进黑名单(防 8h 窗口内回访)

---

### 同事登录失败常见错

| 同事看到 | 真因 | 修 |
|---|---|---|
| Lark 授权页:**"你没有 xxx 的使用权限"** | Lark app **应用可用范围**没含他(§2.1 第 3 层) | `admin.larksuite.com` → 应用管理 → oddfi-admin → 应用可用范围 → 加该同事或改全员。**让对方用无痕窗口重登**(Lark 端有 session 缓存,普通刷新可能还看到旧拒绝) |
| 跳回 `/login?error=NOT_ADMIN` | open_id 不在 admin_users 表 | 检查 §2.3 是否填错 open_id(应 `ou_` 开头);或 §2.2 重查。Lark 这一关过了说明前两层都对,只剩这一行 |
| 跳回 `/login?error=missing_token` | 后端 JWT 签发出错 | SSH 看 admin-backend 日志:`sudo docker logs oddfi-admin-backend --tail 50` |
| 看到 Dashboard 但菜单全无 | 角色被给成 finance(本期无预售权限) | §3 改角色为 operator/customer_service/super_admin |
| 改完可见范围 / admin_users 后**重登仍报旧错** | Lark 或浏览器缓存 | 顺序试:① 浏览器无痕窗口 ② 退出 Lark 账号再重登 ③ 等 1-2 分钟传播 |

## 5. 同事首次登录验证(给同事的话)

> 1. 浏览器打开 `https://admin.oddfi.io`
> 2. 点「Lark 登录」→ 自动跳 Lark 授权页 → 同意
> 3. 自动跳回 `https://admin.oddfi.io/`,看到 Dashboard
> 4. 左侧菜单是你的角色能用的模块。如果你是 finance,会看到「本期无可用模块」空态页 —— 这是正常的(本期 finance 暂未开预售权限)
> 5. 8 小时后 token 过期,需要重新点 Lark 登录
> 6. 退出:右上头像 → 退出登录

如果同事访问后看到 `/login?error=NOT_ADMIN`——说明 admin_users 表里没他;回到本手册 §2 重做一遍。

---

## 6. 常见 FAQ

**Q: 我把 super_admin 不小心降成 operator 了,救?**
A: 找另一个 super_admin 给你改回来。如果整个团队只有你一个 super_admin,前端会 disabled Select + 后端会兜底 `LAST_SUPER_ADMIN` 400,根本降不下去。

**Q: 我手滑删了一个 admin 怎么办?**
A: 重新「新建」加回去就行,token 黑名单会清理(jti 是基于 token 实例,不影响重新登录拿新 token)。审计页能查到删/加的两条记录。

**Q: 同事换了 Lark 账号(比如换了部门换了 open_id)怎么办?**
A: 删旧的,加新的。Lark open_id 与 Lark 账号绑定,换账号 = 换 open_id。

**Q: 同事突然进不去后台了,可能原因?**
A: 排查顺序:
1. 看 admin_users 表里他还在不在(被删?)
2. 看他的 token exp 是否过期(让他点退出再重登)
3. 看 Lark 开放平台 app 状态(被禁用?)
4. 后端日志 grep open_id 看具体拒绝原因

**Q: 怎么导出当前所有管理员名单?**
A: 「管理员管理」列表,翻页 + 截图;或让后端运维直接 `SELECT * FROM admin_users` 拿原始 dump。

---

## 7. 安全提醒

- **不要批量 super_admin**:每多一个 super_admin 多一份配置变更面;典型应 ≤ 3 人(技术负责 + 1-2 个备份)
- **operator 数量按业务团队规模**:一般控制在 5-8 个
- **customer_service / finance**:按实际客服/财务团队
- **拿 open_id 后不要群里乱发**:open_id 是用户在 Lark 内的稳定标识,虽然不是凭据但属于 PII 类信息
- **后台所有写操作都进 audit log**:谁改了什么、之前/之后值,在「操作审计」页可查(5s 实时刷新);怀疑被乱用先去审计页看

---

## 8. 变更本手册

本手册的所在路径 `docs/ops/admin-users-manual.md`,跟代码一起进 git。流程或字段变了 → 改这里 + commit + push。
