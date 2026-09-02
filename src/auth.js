// QQ 开放平台 API-V2 鉴权：AppID + AppSecret 换取 AppAccessToken
// 接口地址：POST https://bots.qq.com/app/getAppAccessToken
// 文档：https://bot.qq.com/wiki/develop/api-v2/dev-prepare/access-token.html
//
// 功能：
//   - 获取 access_token
//   - 带过期缓存（expires_in 内复用，避免频繁请求）
//
// 本模块使用 Node 内置 https 模块，无需 npm 依赖。

const https = require("https");
const crypto = require("crypto");
const { appID, appSecret } = require("./config");

// token 缓存：{ token, expireAt }
let cache = null;

const API_HOST = "bots.qq.com";
const ACCESS_TOKEN_PATH = "/app/getAppAccessToken";

// 简单 HTTPS POST 封装
function post(host, path, bodyObj, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const req = https.request(
      {
        host,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            return reject(new Error(`响应不是合法 JSON: ${data}`));
          }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error("请求超时"));
    });
    req.write(body);
    req.end();
  });
}

// 生成随机设备指纹等（官方 App 场景用；open 平台当前不强制）
function makeDeviceId() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * 获取 access_token（带缓存）。
 * @returns {Promise<string>} access_token
 */
async function getAccessToken({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cache && cache.expireAt > now + 60 * 1000) {
    return cache.token;
  }

  // 官方 open API-V2 使用 appId + clientSecret 参数名
  const payload = {
    appId: appID,
    clientSecret: appSecret,
  };

  const { status, body } = await post(API_HOST, ACCESS_TOKEN_PATH, payload);

  if (status !== 200 || !body || !body.access_token) {
    const err = new Error(
      `获取 access_token 失败 (HTTP ${status}): ${JSON.stringify(body)}`
    );
    err.status = status;
    err.body = body;
    throw err;
  }

  const expiresIn = body.expires_in || 7200; // 默认 2 小时
  cache = {
    token: body.access_token,
    expireAt: now + expiresIn * 1000,
  };
  return cache.token;
}

module.exports = { getAccessToken, post, API_HOST, makeDeviceId };
