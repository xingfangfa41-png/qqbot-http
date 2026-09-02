// QQ 开放平台 API-V2 REST 客户端（主动调用）
// 基础地址：https://api.sgroup.qq.com （接口路径自带 /v2/ 前缀，无需额外前缀）
// 鉴权头  ：Authorization: QQBot <access_token>
// 文档    ：https://bot.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/api-use.html
//
// 本模块使用 Node 内置 https 模块，无需 npm 依赖。

const https = require("https");
const { getAccessToken } = require("./auth");

const BASE_PATH = ""; // API-V2 的接口路径已自带 /v2/ 前缀
const BASE_HOST = "api.sgroup.qq.com";

// 通用 HTTPS 请求（自动携带 token）
async function request(method, path, { body = null, token } = {}) {
  const accessToken = token || (await getAccessToken());

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        host: BASE_HOST,
        path: BASE_PATH + path,
        method,
        headers: Object.assign(
          { Authorization: `QQBot ${accessToken}` },
          body ? { "Content-Type": "application/json" } : {},
          payload ? { "Content-Length": Buffer.byteLength(payload) } : {}
        ),
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch (e) {
            json = data;
          }
          if (res.statusCode >= 400) {
            const err = new Error(
              `API 返回错误 (HTTP ${res.statusCode}): ${JSON.stringify(json)}`
            );
            err.status = res.statusCode;
            err.body = json;
            return reject(err);
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("请求超时")));
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * 获取当前机器人信息
 * ⚠️ 注意：API-V2 当前并不提供 /users/me 公开接口，调用会返回"不支持的调用"(40011002)。
 * 保留此函数仅为占位，实际请以消息接口验证凭证是否有效。
 */
async function getMe() {
  return request("GET", "/users/me");
}

/**
 * 生成消息序号（QQ 要求 msg_seq 为 0~65535）
 */
function genMsgSeq() {
  const timePart = Date.now() % 100000000;
  const random = Math.floor(Math.random() * 65536);
  return (timePart ^ random) % 65536;
}

/**
 * 构建富文本消息体（支持 纯文本/Markdown/带按钮的Markdown）
 * @param {object} o 参数：
 *   - content : 纯文本内容（msg_type 0）
 *   - markdown: Markdown 内容（msg_type 2）
 *   - keyboard: 按钮定义 { content: { rows: [...] } }，挂载到 Markdown 消息底部
 */
function buildMessageBody(o) {
  const base = {
    msg_seq: o.msg_seq ?? genMsgSeq(),
  };
  if (o.msgId) base.msg_id = o.msgId;

  if (o.keyboard) {
    // 按钮挂载在 Markdown 消息底部（官方方式：msg_type 2 + keyboard）
    const md = o.markdown || o.content || "";
    return Object.assign(base, {
      msg_type: 2,
      markdown: typeof md === "string" ? { content: md } : md,
      keyboard: o.keyboard,
    });
  }
  if (o.markdown) {
    // Markdown 富文本
    return Object.assign(base, {
      msg_type: 2,
      markdown: typeof o.markdown === "string" ? { content: o.markdown } : o.markdown,
    });
  }
  // 纯文本
  return Object.assign(base, {
    msg_type: 0,
    content: o.content ?? "",
  });
}

/**
 * 给单个用户（私聊/单聊）发送消息
 * POST /v2/users/{openid}/messages
 * @param {string} openid 接收用户 openid
 * @param {object} opts   发送参数，可含 { content, markdown, keyboard, msgId }；或直接传字符串 content
 */
async function sendC2CMessage(openid, opts) {
  const path = `/v2/users/${encodeURIComponent(openid)}/messages`;
  const o = typeof opts === "string" ? { content: opts } : opts || {};
  const body = buildMessageBody(o);
  return request("POST", path, { body });
}

/**
 * 给某个群发送消息（若机器人开通了群能力）
 * POST /v2/groups/{group_openid}/messages
 * @param {string} groupOpenid 群 openid
 * @param {object} opts        发送参数，可含 { content, markdown, keyboard, msgId }；或直接传字符串 content
 */
async function sendGroupMessage(groupOpenid, opts) {
  const path = `/v2/groups/${encodeURIComponent(groupOpenid)}/messages`;
  const o = typeof opts === "string" ? { content: opts } : opts || {};
  const body = buildMessageBody(o);
  return request("POST", path, { body });
}

/**
 * 主动发给用户：需要拿到用户的 openid（通常在收到私聊事件时获得）
 * 如果你不知道 openid，无法主动发起 C2C 消息（QQ 开放平台限制）。
 */

/**
 * 回应按钮交互事件（PUT /interactions/{interaction_id}）
 * 点击按钮后必须调用，否则客户端一直 loading
 * @param {string} interactionId 交互事件 id
 */
async function replyInteraction(interactionId) {
  const path = `/interactions/${encodeURIComponent(interactionId)}`;
  return request("PUT", path, { body: {} });
}

module.exports = {
  getMe,
  sendC2CMessage,
  sendGroupMessage,
  replyInteraction,
  request,
  BASE_HOST,
  BASE_PATH,
};
