# mTLS 设备准入 Runbook · admin.oddfi.io

> 在 Lark SSO **之外**再加一道**设备级**门禁:只有装了我们签发的客户端证书的电脑,才能打开
> `admin.oddfi.io`(enforce 开启后,没证书连登录页都看不到,TLS 之后直接 403)。
> 2026-06-04 上线,命令均实跑验证过。日常操作可直接用项目 skill:`/mtls-device-cert`。

---

## 0. 一句话速查

```bash
ssh oddfi-admin 'sudo oddfi-mtls issue <name>'      # 发证·p12 流(服务器生成密钥)
ssh oddfi-admin 'sudo oddfi-mtls sign <name> <csr>' # 发证·CSR 流(密钥在设备侧,推荐)
ssh oddfi-admin 'sudo oddfi-mtls revoke <name>'     # 吊销(离职/丢设备,立即生效)
ssh oddfi-admin 'sudo oddfi-mtls list'              # 看已发证书
ssh oddfi-admin 'sudo oddfi-mtls enforce on|off|status'  # 强制/观察模式开关
```

---

## 1. 架构与设计决策

```
浏览器 ──TLS 握手(出示客户端证书)──▶ Nginx :443
                                      ├─ ssl_client_certificate → 用自签 CA 验证
                                      ├─ ssl_crl → 吊销名单(CRL)
                                      ├─ ssl_verify_client optional → 不在握手层硬拒
                                      └─ include enforce.conf
                                           ├─ ON : verify≠SUCCESS → 403(全站,含 /admin /auth /health)
                                           └─ OFF: 只记日志(观察模式)
通过后 → 正常 SPA / Lark OAuth / JWT 流程(本机制完全独立于应用层鉴权,叠加不替代)
```

**关键决策**(定了,不要再争):

| 决策 | 原因 |
|---|---|
| `optional` + if-403,而非 `ssl_verify_client on` | 切换/回滚只动一个 include 文件 + reload;无证书用户看到 403 而非浏览器握手错误页,好排障 |
| CRL 有效期 3650 天(`default_crl_days`) | **CRL 过期会导致 nginx 拒掉所有客户端证书**(全员被锁),长效期规避;每次 revoke 都会重新生成 |
| p12 用 SHA1-3DES 老算法导出 | OpenSSL 3 默认 AES-256/PBKDF2 的 p12 会被 macOS `security import` 拒收("MAC verification failed",实测踩坑);密码只保护传输,密钥安全靠文件权限 |
| key 服务器侧生成(而非设备 CSR) | 内部小团队,运维简单优先;p12 通过安全渠道传输补偿 |
| 证书内容只有 `CN=<设备名>` | 准入只看"证书是否由我们 CA 签发且未吊销",**人的身份仍由 Lark SSO 负责**,不在证书里重复建模 |

**服务器文件布局**(`oddfi-admin`,全部 root-only):

```
/etc/nginx/mtls/
├── ca/              # CA 私钥(400)/证书/index.txt/serial/openssl.cnf/ca.crl
├── issued/<name>/   # 每设备 client.{key,crt,pem,p12}(吊销后目录改名 *.revoked.<ts>)
└── enforce.conf     # 开关 include(oddfi-mtls enforce 重写它)
/usr/local/sbin/oddfi-mtls            # 管理脚本(真值源在前端仓库 deploy/mtls/oddfi-mtls)
/etc/nginx/conf.d/mtls-logformat.conf # 观察日志格式
/var/log/nginx/admin.mtls.log         # 每请求 verify=SUCCESS/NONE/FAILED:* + 证书 DN
```

---

## 2. 不受影响的链路(改动前已排查)

- **部署**:rsync 走 SSH,不过 443 → 不受影响;`deploy.sh` 公网验证已改用 `pubcurl`(自动带证书)
- **certbot 续期**:HTTP-01 走 80 端口(无 mTLS)→ 不受影响
- **Lark OAuth**:跳转/回调都发生在**用户浏览器**(有证书),Lark 服务器不直连本域 → 不受影响
- **CI**:两个 workflow 都不请求 admin.oddfi.io → 不受影响
- ⚠️ **受影响**:任何打 `https://admin.oddfi.io/*` 的裸 curl / 外部拨测(含 `/health`),enforce 后一律 403

---

## 3. Nginx 配置事实(已就位,灾备重建参考)

vhost `/etc/nginx/sites-available/admin.oddfi.io` 的 443 server 块内,`ssl_ciphers` 之后:

```nginx
# mTLS 设备准入（白名单设备才放行；管理: sudo oddfi-mtls；指南: 前端仓库 docs/ops/mtls-runbook.md）
ssl_client_certificate /etc/nginx/mtls/ca/ca.crt;
ssl_crl                /etc/nginx/mtls/ca/ca.crl;
ssl_verify_client      optional;
include                /etc/nginx/mtls/enforce.conf;
access_log             /var/log/nginx/admin.mtls.log mtls;
```

灾备从零重建:装脚本(§7)→ `sudo oddfi-mtls init` → 把上面 5 行插回 vhost → `nginx -t && reload` → 全员重新发证。

---

## 4. 新设备 onboarding(最高频操作)

> **首选 · CSR/agent 流**:[`mtls-agent-onboarding.md`](./mtls-agent-onboarding.md) — 同事用自己的 Claude Code 本机生成私钥+CSR,双向传自描述 zip,私钥不出设备、无密码传输;两侧 agent 自动接力(`sign` 子命令,2026-06-04 打样验证)。
> **备选 · 人工 p12 流**(同事无 Claude Code / Windows):[`mtls-onboarding-lark.md`](./mtls-onboarding-lark.md),即本节以下流程。

### 4.1 签发(在你电脑上执行)

```bash
ssh oddfi-admin 'sudo oddfi-mtls issue alice-mbp'   # 设备名 kebab-case: 人名-设备
# 输出里有 p12 密码 —— 只打印这一次,立刻复制
```

### 4.2 取回 + 传给同事

```bash
# 文件是 root 600,用 sudo cat 流式拉取
ssh oddfi-admin 'sudo cat /etc/nginx/mtls/issued/alice-mbp/client.p12' > /tmp/alice-mbp.p12
```

- **传输纪律**:p12 文件和密码**分通道**发(如文件走 AirDrop/Lark 私聊,密码走另一条私聊或口头);**禁止**发群、禁止文件+密码同一条消息
- 同事导入成功后,提醒其删除收到的 p12 文件

### 4.3 同事侧导入(macOS)

```bash
# 方式 A · CLI(推荐,顺带把 curl 用的 pem 也装好)
mkdir -p ~/.config/oddfi-mtls && chmod 700 ~/.config/oddfi-mtls
mv ~/Downloads/alice-mbp.p12 ~/.config/oddfi-mtls/client.p12 && chmod 600 ~/.config/oddfi-mtls/client.p12
security import ~/.config/oddfi-mtls/client.p12 -k ~/Library/Keychains/login.keychain-db -P '<p12密码>'
security set-identity-preference -s "https://admin.oddfi.io" -c "alice-mbp"   # Safari 免弹窗
```

> 方式 B · 双击 p12 → Keychain Access 输密码导入,效果相同(但没有 identity preference,Safari 每次会问)。

### 4.4 验证

1. 浏览器开 `https://admin.oddfi.io` → 弹证书选择 → 选 `oddfi-admin-alice-mbp` → 第一次会再弹 Keychain 授权,点**始终允许**
2. 运维侧确认:`ssh oddfi-admin 'sudo tail /var/log/nginx/admin.mtls.log'` 应出现 `verify=SUCCESS dn="O=OddFi,CN=alice-mbp"`

**浏览器说明**:Safari/Chrome/Edge/Arc 走系统 Keychain,导入一次全生效;**Firefox 用独立证书库**,需在 `设置 → 隐私与安全 → 证书 → 查看证书 → 您的证书 → 导入` 再导一次 p12。

**部署机额外一步**(跑 `deploy.sh` 的机器):把 `client.pem` 也拉到本地,`pubcurl` 自动识别:

```bash
ssh oddfi-admin 'sudo cat /etc/nginx/mtls/issued/<name>/client.pem' > ~/.config/oddfi-mtls/client.pem
chmod 600 ~/.config/oddfi-mtls/client.pem
```

---

## 5. 吊销(离职 / 设备丢失 / 疑似泄漏)

```bash
ssh oddfi-admin 'sudo oddfi-mtls revoke alice-mbp'
# = openssl ca -revoke + 重新生成 CRL + nginx reload,enforce=on 时立即把该设备挡在 403
```

- 吊销**不可逆**;同人换新设备直接 `issue alice-mbp2` 发新证即可
- 吊销后服务器上目录改名为 `issued/alice-mbp.revoked.<ts>` 留痕
- ⚠️ 吊销只断"设备进门";该同事的**账号权限**另走 [`admin-users-manual.md`](./admin-users-manual.md) 收回

---

## 6. enforce 开关与上线节奏

```bash
ssh oddfi-admin 'sudo oddfi-mtls enforce status'   # 看当前模式
ssh oddfi-admin 'sudo oddfi-mtls enforce on'       # 强制:无证书全站 403
ssh oddfi-admin 'sudo oddfi-mtls enforce off'      # 观察:只记日志,不拦
```

**标准上线节奏**(避免把还没装证书的同事锁在门外):

1. `enforce off`(观察模式)下给**所有在用设备**发证(§4)
2. 跑几天看日志确认没有漏网设备:
   ```bash
   ssh oddfi-admin "sudo awk '/verify=NONE/{print \$1}' /var/log/nginx/admin.mtls.log | sort | uniq -c | sort -rn"
   # 输出 = 还在裸连的来源 IP;清零(或只剩外部扫描器)即可切
   ```
3. `enforce on`,并在 Lark 群里通知一句
4. 有人被 403:先查 `oddfi-mtls list` 看其证书状态,而不是先切回 off

---

## 7. 脚本更新方式

真值源 = 本仓库 [`deploy/mtls/oddfi-mtls`](../../deploy/mtls/oddfi-mtls)(改这里,review 后再装到服务器):

```bash
scp deploy/mtls/oddfi-mtls oddfi-admin:/tmp/oddfi-mtls
ssh oddfi-admin 'sudo install -m 755 -o root -g root /tmp/oddfi-mtls /usr/local/sbin/oddfi-mtls && rm /tmp/oddfi-mtls'
```

---

## 8. CA 灾备与到期

- **CA 私钥唯一副本在服务器** `/etc/nginx/mtls/ca/ca.key`(400, root)。**不要**拉到本地/iCloud/仓库
- 服务器盘炸 = CA 没了 → 按 §3 重建 + 全员重发证。小团队重发成本 ≈ 半小时,**接受此风险换取不维护第二份私钥副本**;若团队超 ~15 设备再考虑加密冷备
- 到期:CA 10 年(2036-06),客户端证书默认 **180 天**(2026-06-04 安全评审从 730 收紧——短 TTL 防"未被发现的泄露",已发现的泄露走 revoke 即时止血);到期前重走 agent 申请流换新(3 分钟)。`oddfi-mtls list` 看全量到期日

---

## 9. 排障速查

| 症状 | 原因 | 处理 |
|---|---|---|
| 浏览器/接口 403,页面全白 | enforce=on 且该设备无有效证书 | `oddfi-mtls list` 查状态;没发过 → §4;吊销过 → 重新 issue |
| `security import` 报 "MAC verification failed" | p12 不是 SHA1-3DES 导出(旧脚本/手工导的) | 用当前版脚本重新 `issue`,或服务器上手工带 `-certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1` 重导 |
| 浏览器不弹证书选择 | p12 没进 login keychain;或 Firefox(独立证书库) | `security find-identity ~/Library/Keychains/login.keychain-db`(**不带 `-v`**)应列出 `<name>`;Firefox 单独导 |
| `find-identity -v` 显示 0 valid / 身份标 `CSSMERR_TP_NOT_TRUSTED` | 私有 CA 不在系统信任库,属**正常现象** | 不影响浏览器选用(客户端证书匹配看服务器要求的 CA DN,不走系统信任评估);用不带 `-v` 的命令确认身份存在即可,**不要**为此把 CA 设为系统信任 |
| 选了证书仍 403/400 | 证书被吊销(CRL 命中)或过期 | 看 `admin.mtls.log` 的 `verify=FAILED:<reason>`;重新发证。注意:**吊销/过期证书即使在观察模式也会被 nginx 直接 400**(`optional` 只放行"无证书",不放行"坏证书",2026-06-04 打样实测) |
| **所有人**突然 403 | CRL 过期(理论上 2036 年前不会)或 vhost/CA 文件被动过 | 应急:`sudo oddfi-mtls enforce off` 先放行,再查 `nginx -t` + `admin.mtls.log` |
| deploy.sh 公网验证失败 | 本机没有 `~/.config/oddfi-mtls/client.pem` 而 enforce=on | §4.4 部署机步骤补 pem |
| 外部拨测 /health 失败 | enforce 全站拦截(含 /health) | 拨测改打 SSH 内网 `curl 127.0.0.1:8081/health`,或给拨测机发证 |

---

## 10. 已发证书登记(每次 issue/revoke 登一行)

| 日期 | 设备名 | 使用人 | 状态 | 备注 |
|---|---|---|---|---|
| 2026-06-04 | `hang-mbp` | hank | valid(至 2026-12-01) | 首张(730d 版已吊销),按 180d 新政重签;兼任部署机(pem 已装) |
| 2026-06-04 | `demo-test` | — | REVOKED | 同事 onboarding(p12 流)打样,验证完即吊销 |
| 2026-06-04 | `demo-csr` | — | REVOKED | CSR/agent 流打样(sign 子命令 + CN 守卫 + 本地合成 p12),验证完即吊销 |
| 2026-06-04 | `david-mbp` | david | valid(至 2026-12-01) | 首单真实 CSR/agent 流,申请包三项校验全过 |
| 2026-06-06 | `zoe-mbp` | zoe | valid(至 2026-12-03) | CSR/agent 流,CN 校验通过,firefox=false |
