// QQ 开放平台 API-V2 WebSocket 网关客户端
// 协议基于 QQ Bot API-V2（与官方 SDK 一致）：
//   - 连接 /gateway 返回的 wss 地址，URL 带 access_token 参数
//   - 收到 op:10 (HELLO) 后发送 op:2 (IDENTIFY)
//   - 心跳：op:1 发送 {d: lastSeq}，收到 op:11 (HEARTBEAT_ACK)
//   - op:0 + t:READY 表示就绪，后续收到事件 dispatch
//
// 依赖：Node 26 内置全局 WebSocket，无需 npm 依赖。

const { getAccessToken } = require("./auth");
const { request } = require("./client");

// 事件 intent（位掩码）
const INTENTS = {
  PUBLIC_GUILD_MESSAGES: 1 << 30, // 频道消息
  DIRECT_MESSAGE: 1 << 12, // 频道私信
  GROUP_AND_C2C: 1 << 25, // 群聊 + C2C 私聊（核心）
  INTERACTION: 1 << 26, // 按钮交互
};

// 订阅群聊+C2C 和按钮交互（最常用）
const DEFAULT_INTENTS = INTENTS.GROUP_AND_C2C | INTENTS.INTERACTION;

// 重连延迟（秒）
const RECONNECT_DELAYS = [1, 2, 5, 10, 30, 60];
const MAX_RECONNECT_ATTEMPTS = 100;

class QQBotGateway {
  constructor({ intents = DEFAULT_INTENTS, log = console, onEvent, onReady } = {}) {
    this.intents = intents;
    this.log = log;
    this.onEvent = onEvent; // (eventName, data) => {}
    this.onReady = onReady;
    this.ws = null;
    this.lastSeq = null;
    this.heartbeatTimer = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.running = false;
  }

  async getGatewayUrl() {
    const { body } = await request("GET", "/gateway");
    if (!body || !body.url) {
      throw new Error("获取网关地址失败: " + JSON.stringify(body));
    }
    return body.url;
  }

  async connect() {
    this.running = true;
    const gatewayUrl = await this.getGatewayUrl();
    const token = await getAccessToken();
    this.log.log?.("[gateway] 网关地址:", gatewayUrl);
    return this.connectWS(gatewayUrl, token);
  }

  connectWS(gatewayUrl, token) {
    // 拼接 access_token 到 URL
    const u = new URL(gatewayUrl);
    u.searchParams.set("access_token", token);

    this.log.log?.("[gateway] 正在连接 WebSocket ...");
    const ws = new WebSocket(u.toString());

    ws.onopen = () => {
      this.log.log?.("[gateway] ✅ WebSocket 已连接");
      this.reconnectAttempts = 0;
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data.toString());
      } catch (e) {
        return;
      }
      this.handleMessage(msg);
    };

    ws.onclose = (ev) => {
      this.log.log?.("[gateway] 连接关闭:", ev.code, ev.reason || "");
      this.stopHeartbeat();
      if (this.running) {
        // 4004 = token 无效，刷新 token 后重连
        if (ev.code === 4004) {
          this.log.log?.("[gateway] token 无效(4004)，刷新后重连 ...");
          this.scheduleReconnect(true);
        } else {
          this.scheduleReconnect();
        }
      }
    };

    ws.onerror = (err) => {
      this.log.error?.("[gateway] WebSocket 错误:", err?.message || err);
    };

    this.ws = ws;
  }

  handleMessage(msg) {
    const { op, d, s, t } = msg;

    if (op === 10) {
      // HELLO
      const interval = d?.heartbeat_interval || 30000;
      this.log.log?.("[gateway] 收到 HELLO, 心跳间隔", interval, "ms");
      this.startHeartbeat(interval);
      this.sendIdentify();
      return;
    }
    if (op === 11) {
      // HEARTBEAT_ACK
      return;
    }
    if (op === 1) {
      // 服务端要求心跳
      this.sendHeartbeat();
      return;
    }
    if (op === 7) {
      // 要求重连
      this.log.log?.("[gateway] 收到 op:7 重连指令");
      this.scheduleReconnect();
      return;
    }
    if (op === 9) {
      // 鉴权失败
      this.log.error?.("[gateway] op:9 鉴权失败（无效 token）");
      return;
    }
    if (s) this.lastSeq = s;

    if (op === 0 && t === "READY") {
      this.log.log?.("[gateway] 🎉 READY，机器人已上线！");
      this.onReady?.();
      return;
    }
    if (op === 0 && t) {
      // 分发事件
      this.log.log?.("[gateway] 事件:", t);
      this.onEvent?.(t, d);
    }
  }

  sendIdentify() {
    const token = `QQBot ${this.getCurrentToken()}`;
    const identify = {
      op: 2,
      d: {
        token,
        intents: this.intents,
        shard: [0, 1],
      },
    };
    this.ws?.send(JSON.stringify(identify));
    this.log.log?.("[gateway] 已发送 IDENTIFY, intents:", this.intents);
  }

  getCurrentToken() {
    return this._token;
  }

  sendHeartbeat() {
    const hb = { op: 1, d: this.lastSeq };
    this.ws?.send(JSON.stringify(hb));
  }

  startHeartbeat(interval) {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), interval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect(refreshToken = false) {
    if (!this.running) return;
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.log.error?.("[gateway] 重连次数达上限，停止");
      return;
    }
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)] * 1000;
    this.reconnectAttempts++;
    this.log.log?.(`[gateway] ${delay / 1000}s 后重连 (第 ${this.reconnectAttempts} 次)`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        let gatewayUrl = this._gatewayUrl;
        if (refreshToken || !gatewayUrl) {
          gatewayUrl = await this.getGatewayUrl();
          this._gatewayUrl = gatewayUrl;
        }
        const token = await getAccessToken({ forceRefresh: refreshToken });
        this._token = token;
        this.connectWS(gatewayUrl, token);
      } catch (e) {
        this.log.error?.("[gateway] 重连失败:", e.message);
        this.scheduleReconnect(refreshToken);
      }
    }, delay);
  }

  async start() {
    const gatewayUrl = await this.getGatewayUrl();
    this._gatewayUrl = gatewayUrl;
    this._token = await getAccessToken();
    await this.connectWS(gatewayUrl, this._token);
  }

  disconnect() {
    this.running = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "bye");
      } catch (e) {}
      this.ws = null;
    }
  }
}

module.exports = { QQBotGateway, INTENTS };
