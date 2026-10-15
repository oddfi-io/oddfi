# 运营后台设备证书安装指南(同事版·人工 p12 流,贴 Lark 用)

> ⚠️ 本文是**备选流程**:同事没有 Claude Code 或用 Windows 时才走这套。
> 有 Claude Code 的同事首选 agent 自助版:[`mtls-agent-onboarding.md`](./mtls-agent-onboarding.md)(私钥不出设备、无密码传输)。
> 维护真值源在 [`mtls-runbook.md`](./mtls-runbook.md)(§4)。内容有变(如换域名、新浏览器坑)→ 改这里 + 重新贴 Lark。

## 〇、管理员侧流程(hank 自用,这一节不贴 Lark)

**1. 同事需要给我的信息**(在 Lark 贴文末尾让大家私聊报这三项):

| 信息 | 用途 | 示例 |
|---|---|---|
| 英文名/拼音 | 设备命名 `人名-设备` | `alice` |
| 设备类型 + 台数 | 一台设备一张证书 | `Mac×1` / `Mac+Win 各一台` |
| 是否用 Firefox | 要额外多导一次,提前提醒 | 是/否 |

**2. 我对每台设备做的动作**(对 Claude Code 说「给 alice 发证书」可代跑前两步):

```bash
# ① 签发(输出里的 p12 密码只打印一次,立刻复制)
ssh oddfi-admin 'sudo oddfi-mtls issue alice-mbp'

# ② 取回(必须 sudo cat,scp 直拉会 Permission denied)
ssh oddfi-admin 'sudo cat /etc/nginx/mtls/issued/alice-mbp/client.p12' > /tmp/alice-mbp.p12
```

③ **分通道交付**:Lark 私聊发 p12 文件 → **另一条消息**(或口头)发安装密码;禁止发群、禁止文件+密码同一条
④ 同事按下方正文自助安装,装完让 TA 回我一声「能打开后台了」
⑤ **我侧确认**:`ssh oddfi-admin 'sudo tail /var/log/nginx/admin.mtls.log'` 出现 `verify=SUCCESS dn="O=OddFi,CN=alice-mbp"` 才算数
⑥ 登记:[`mtls-runbook.md`](./mtls-runbook.md) §10 表加一行;删掉本地 `/tmp/alice-mbp.p12`

**3. 全员完成后收口**:

```bash
# 漏网检查:还有内部 IP 裸连就先补,清零(或只剩外部扫描器)再切
ssh oddfi-admin "sudo awk '/verify=NONE/{print \$1}' /var/log/nginx/admin.mtls.log | sort | uniq -c | sort -rn"
ssh oddfi-admin 'sudo oddfi-mtls enforce on'   # 切完在群里知会一声
```

---

**以下为 Lark 贴文正文,整段复制即可。**

---

# 📌 运营后台新增设备验证 — 安装指南

后台 `admin.oddfi.io` 加了一道**设备级安全验证**:每台办公电脑需要安装一张专属证书才能访问(防止账号密码泄漏后被外部登录)。**每人每台设备装一次,半年换一次(到期前 hank 会提醒)。**

## 第一步:私聊 hank 领证书,报三样

1. 你的英文名/拼音(如 `alice`)
2. 设备类型和台数(如 `Mac 一台` / `Mac + Windows 各一台`,每台都要装)
3. 平时用不用 Firefox(用的话安装多一步,我会提前说明)

## 你会收到两条消息(分开发的,这是故意的)

1. 一个证书文件:`你的名字-mbp.p12`
2. 一串安装密码

⚠️ 这张证书**绑定你这台电脑**:不要转发给任何人、不要存网盘/群文件。装完把收到的文件删掉。

## 安装(Mac,1 分钟)

1. **双击**收到的 `.p12` 文件
2. 弹出「钥匙串访问」输入框 → 粘贴你收到的**安装密码**(不是开机密码)→ 确定
3. 完成,没有第 3 步

> 如果双击没反应:打开「钥匙串访问」app → 左侧选「登录」→ 菜单 文件 → 导入项目 → 选中 p12 文件。

## 首次打开后台

1. 浏览器访问 `https://admin.oddfi.io`
2. 弹出「选择证书」窗口 → 选中 `oddfi-admin-你的名字-mbp` → 确定
3. 可能再弹一次系统授权 → 输**开机密码** → 点「**始终允许**」(选这个以后就不弹了)
4. 之后照常 Lark 登录,和以前一样

## 特殊情况

- **用 Firefox 的同事**:Firefox 不认系统证书,要在 `设置 → 隐私与安全 → 证书 → 查看证书 → 您的证书 → 导入` 里再导一次 p12 文件
- **Windows 同事**:双击 p12 → 证书导入向导 → 存储位置选「当前用户」→ 一路下一步,输密码即可
- **换电脑 / 新增设备 / 重装系统**:找 hank 重新发一张,旧的会作废

## 遇到问题

| 现象 | 原因 / 处理 |
|---|---|
| 打开后台显示 403 或一片空白 | 证书没装好或没选 → 重走「安装」+「首次打开」;还不行找 hank |
| 没弹「选择证书」窗口 | 证书没进钥匙串 → 重新双击 p12 导入 |
| 输安装密码报错 | 密码复制带了空格/换行 → 手动输入再试 |
| 浏览器提示证书已过期/被吊销 | 找 hank 重新发证 |

有任何卡住的地方直接 Lark 私聊 hank,不要自己折腾钥匙串里的其他证书。
