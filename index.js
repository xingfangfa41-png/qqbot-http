#!/usr/bin/env node
// QQ 开放平台官方机器人 HTTP 接口工具（API-V2）
//
// 用法：
//   node index.js me              -> 获取机器人信息（验证凭证）
//   node index.js send-c2c <openid> <内容>  -> 给单个用户发消息
//   node index.js send-group <groupOpenid> <内容> -> 给群发消息
//
// 注意：本设备沙箱无外网，需在能联网的机器上运行才能真正连通。

const { getMe, sendC2CMessage, sendGroupMessage } = require("./src/client");
const { getAccessToken } = require("./src/auth");

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "me": {
      const res = await getMe();
      console.log("✅ 机器人信息获取成功:");
      console.log(JSON.stringify(res.body, null, 2));
      break;
    }
    case "send-c2c": {
      const [openid, ...rest] = args;
      const content = rest.join(" ");
      if (!openid || !content) {
        console.error("用法: node index.js send-c2c <openid> <消息内容>");
        process.exit(1);
      }
      const res = await sendC2CMessage(openid, { content });
      console.log("✅ 单聊消息已发送:");
      console.log(JSON.stringify(res.body, null, 2));
      break;
    }
    case "send-group": {
      const [groupOpenid, ...rest] = args;
      const content = rest.join(" ");
      if (!groupOpenid || !content) {
        console.error("用法: node index.js send-group <groupOpenid> <消息内容>");
        process.exit(1);
      }
      const res = await sendGroupMessage(groupOpenid, { content });
      console.log("✅ 群消息已发送:");
      console.log(JSON.stringify(res.body, null, 2));
      break;
    }
    case "token": {
      const token = await getAccessToken({ forceRefresh: true });
      console.log("✅ access_token 获取成功:");
      console.log(token);
      break;
    }
    default: {
      console.log(`
QQ 开放平台官方机器人 HTTP 工具（API-V2）

可用命令:
  node index.js me                        获取机器人信息（验证凭证）
  node index.js token                     获取 access_token
  node index.js send-c2c <openid> <内容>   发送单聊消息
  node index.js send-group <groupOpenid> <内容> 发送群消息

注意: 当前设备无外网，需在能联网的机器上运行才能真正连通。
`);
    }
  }
}

main().catch((e) => {
  console.error("\n❌ 出错:", e.message);
  if (e.message.includes("ECONNREFUSED") || e.message.includes("socket hang up") || e.message.includes("getaddrinfo")) {
    console.error("→ 无法连接到 QQ 服务器。请确认: 1) 运行环境能上网 2) 网络策略未拦截 api.sgroup.qq.com / bots.qq.com");
  }
  process.exit(1);
});
