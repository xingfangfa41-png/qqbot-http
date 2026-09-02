# QQ 开放平台官方机器人 · WebSocket 实时收发消息

基于 **QQ 官方 API-V2** 的机器人项目，支持：
- 🟢 **WebSocket 实时在线**：官方网关长连接，自动心跳保活、断线重连
- 💬 **私聊自动回复**：接收 `C2C_MESSAGE_CREATE` 事件并回复
- 👥 **群聊@回复**：接收 `GROUP_AT_MESSAGE_CREATE` 事件并回复
- 📡 **HTTP 主动调用**：也能主动调 REST 接口（发消息等）

无需挂 QQ 客户端，用官方机器人的 **AppID + AppSecret** 鉴权即可。

> ⚠️ **重要**：本项目的 `.env` 含你的 AppSecret，属于敏感凭证。
> **切勿提交到 Git / 公开分享。** 若已泄露，请到 [QQ 开放平台](https://q.qq.com/) 后台重置密钥。

---

## 一、项目结构

```
qqbot-http/
├── .env.example        # 环境变量模板（复制为 .env）
├── .gitignore          # 忽略 .env / node_modules
├── bot.js              # ⭐ 主机器人（WebSocket 实时收发消息）
├── index.js            # HTTP 主动调用命令行入口
├── package.json
├── src/
│   ├── config.js       # 加载 .env
│   ├── auth.js         # 获取 access_token（带缓存）
│   ├── client.js       # API-V2 REST 客户端（发消息等）
│   └── gateway.js      # WebSocket 网关客户端（心跳/重连）
└── examples/
    └── get-me.js       # 示例：获取机器人信息
```

## 二、启动机器人（实时收发消息）

```bash
cd qqbot-http
cp .env.example .env     # 填入你的 AppID / AppSecret（本项目已生成 .env）
node bot.js              # 启动 WebSocket 机器人
```

看到 `🤖 机器人已上线！` 即成功。现在：
- 用 QQ **私聊**你的机器人 → 自动回复
- 在群里 **@机器人** → 自动回复

> 注意：QQ 开放平台要求机器人在**沙箱环境**或通过**审核上架**后才能对真实用户/群生效。
> 沙箱模式下，需要将测试用户的 QQ 号添加为沙箱成员。

## 二、部署步骤（在能联网的机器/服务器上）

### 1. 准备
- 需要 **Node.js 16+**（本项目纯用 Node 内置模块，无需 npm install 任何依赖）

### 2. 拷贝代码并填配置
```bash
# 把整个 qqbot-http 目录拷到目标机器
cd qqbot-http
cp .env.example .env    # 然后编辑 .env，填入你的 AppID / AppSecret
```

`.env` 内容：
```
QQ_APP_ID=1905545392
QQ_APP_SECRET=j6UsHg6WxOqIlEiChDjGnLtS1bBmO1eI
```

### 3. 验证凭证（能否连通）
```bash
node index.js token     # 获取 access_token —— 能拿到即凭证有效、网络通
```
> 说明：`getMe`（`/users/me`）当前在 API-V2 返回"不支持的调用"(40011002)，
> 属于接口本身不开放，不代表凭证无效。**验证凭证请用 `node index.js token`。**

### 4. 主动发消息
```bash
# 给单个用户发私聊（需要该用户的 openid）
node index.js send-c2c <openid> "你好"

# 给群发消息（需机器人开通群能力）
node index.js send-group <groupOpenid> "大家好"
```

---

## 三、鉴权原理（API-V2）

1. **换 token**：`POST https://bots.qq.com/app/getAppAccessToken`
   ```json
   { "appId": "1905545392", "clientSecret": "j6Us..." }
   ```
   → 返回 `access_token` + `expires_in`（默认 7200 秒）
2. **调业务接口**：在请求头带上
   ```
   Authorization: QQBot <access_token>
   ```
3. **Base URL**：`https://api.sgroup.qq.com`（接口路径自带 `/v2/` 前缀，如发消息 `POST /v2/users/{openid}/messages`，**无** `/api/v2` 前缀）
4. token 过期前会自动复用（本项目已内置缓存，`expires_in` 前自动刷新）

参考文档：
- [获取访问凭证 access-token](https://bot.qq.com/wiki/develop/api-v2/dev-prepare/access-token.html)
- [接口调用与鉴权](https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/api-use.html)
- [发送单聊消息](https://bot.qq.com/wiki/develop/api-v2/autogen/api/v2_users_user_openid_messages.post.html)

---

## 四、关于"主动发 C2C 消息"的说明

QQ 开放平台对**主动发单聊消息**有严格限制：
- 必须先收到过该用户的**私聊消息**（拿到其 `openid`）才能主动回复
- 纯主动营销式推送通常被禁止，需符合平台规范

所以 `send-c2c` 需要你先在收到私聊事件时保存用户的 `openid`。
如果你需要**实时接收**用户消息并自动回复，需要改用 **WebSocket 长连接**模式（本项目是 HTTP 主动调用版）。

---

## 五、常见问题

| 现象 | 原因 / 处理 |
|------|------------|
| `getaddrinfo ENOTFOUND` / `ECONNREFUSED` | 无外网或域名被拦，需在能联网的机器上跑 |
| `access_token 获取失败 (HTTP 401)` | AppID / AppSecret 错误或未生效 |
| `msg_type` / openid 相关报错 | 需先通过事件拿到真实 openid，或机器人未开通对应能力 |
| 找不到用户 / 无法主动发 | 开放平台限制主动 C2C，需先有会话 |
