#!/usr/bin/env node
// QQ 开放平台官方机器人 · WebSocket 实时收发消息版
//
// 功能：
//   - 通过官方 WebSocket 网关上线
//   - 接收私聊消息 (C2C_MESSAGE_CREATE) 并自动回复
//   - 接收群聊@消息 (GROUP_AT_MESSAGE_CREATE) 并自动回复
//   - 心跳保活 + 断线自动重连
//
// 用法：node bot.js
//
// 依赖：Node 26 内置 WebSocket，无需 npm 安装。

const { QQBotGateway } = require("./src/gateway");
const { sendC2CMessage, sendGroupMessage, replyInteraction } = require("./src/client");

// ===== 功能菜单配置 =====
// 在这里集中管理所有功能，方便以后扩展
const COMMUNITY_SITE_URL = "https://ec-crystal-war.com/EC%E7%A4%BE%E7%BE%A4%E8%87%AA%E6%B2%BB.html";

// ===== 能力开关 =====
// QQ 开放平台需要申请开通对应能力后才能用
//   - ENABLE_MARKDOWN: Markdown 富文本（msg_type 2），已验证可用
//   - ENABLE_BUTTON : 可点击按钮（Markdown 底部挂载），已验证可用
const ENABLE_MARKDOWN = true;
const ENABLE_BUTTON = true;

// 反馈群配置
const FEEDBACK_GROUP_ID = "785249992"; // 机器人反馈群 QQ 群号

// 按钮菜单（Markdown 精美排版 + 底部按钮）
function buildButtonMenu() {
  return {
    markdown: [
      "## 🤖 **EC社群 · 机器人服务**",
      "",
      "> 欢迎使用！请选择下方功能 👇",
      "",
      "---",
      "",
      "**1️⃣ 访问社群站**",
      "> 🌐 打开我们的社群自治官网",
      "",
      "**2️⃣ 查询EC社群**",
      "> 🔍 社群数据查询（开发中）",
      "",
      "**3️⃣ 反馈建议**",
      "> 💬 加入反馈群，告诉我们你的想法",
      "",
      "---",
      "",
      "💡 *点击下方按钮，即可快速使用*",
    ].join("\n"),
    keyboard: {
      content: {
        rows: [
          {
            buttons: [
              {
                id: "1",
                render_data: { label: "🌐 访问社群站", style: 1 },
                action: {
                  type: 1, // 回调按钮：点击直接触发交互，机器人自动回复
                  data: "site",
                  permission: { type: 2 }, // 2=所有人可操作
                },
              },
              {
                id: "2",
                render_data: { label: "🔍 查询EC社群", style: 1 },
                action: {
                  type: 1,
                  data: "ec",
                  permission: { type: 2 },
                },
              },
            ],
          },
          {
            buttons: [
              {
                id: "3",
                render_data: { label: "💬 反馈建议", style: 1 },
                action: {
                  type: 1,
                  data: "feedback",
                  permission: { type: 2 },
                },
              },
            ],
          },
        ],
      },
    },
  };
}

// 菜单文案（纯文本版，备用）
const MENU_TEXT = [
  "🤖 机器人功能菜单：",
  "",
  "【1】访问社群站",
  "   —— 打开我们的社群自治官网",
  "【2】查询EC社群（开发中）",
  "   —— 后续接入社群数据",
  "【3】反馈建议",
  "   —— 加入反馈群，告诉我们你的想法",
  "",
  "💡 回复对应数字或功能名即可使用，例如：",
  "  · 发送「1」或「社群站」→ 获取社群站链接",
].join("\n");

// 菜单（Markdown 版）
const MENU_MARKDOWN = [
  "## 🤖 **EC社群 · 机器人服务**",
  "",
  "> 欢迎使用！请选择功能 👇",
  "",
  "---",
  "",
  "**1️⃣ 访问社群站**",
  "> 🌐 打开我们的社群自治官网",
  "",
  "**2️⃣ 查询EC社群**",
  "> 🔍 社群数据查询（开发中）",
  "",
  "**3️⃣ 反馈建议**",
  "> 💬 加入反馈群，告诉我们你的想法",
  "",
  "---",
  "",
  "💡 *回复数字，或点击下方按钮使用*",
].join("\n");

// 社群站回复（纯文本版，备用）
const SITE_TEXT = [
  "🌐 欢迎访问我们的社群自治站！",
  "",
  "📎 点击链接进入：",
  COMMUNITY_SITE_URL,
  "",
  "💡 也可以直接复制上方链接到浏览器打开。",
  "发送「菜单」可查看所有功能。",
].join("\n");

// 社群站回复（Markdown 精美版）
const SITE_MARKDOWN = [
  "## 🌐 **EC社群自治站**",
  "",
  "> *共建 · 共享 · 自治*",
  "",
  "---",
  "",
  "📎 **点击进入官网：**",
  "",
  "[🚀 打开社群自治官网](https://ec-crystal-war.com/EC%E7%A4%BE%E7%BE%A4%E8%87%AA%E6%B2%BB.html)",
  "",
  "---",
  "",
  "💡 *发送「菜单」可返回功能列表*",
].join("\n");

// 查询EC社群回复（Markdown 精美版）
const EC_MARKDOWN = [
  "## 🔍 **查询EC社群**",
  "",
  "> 🚧 *功能开发中...*",
  "",
  "---",
  "",
  "该功能正在接入社群数据，",
  "预计**下午**可用。",
  "",
  "✨ 敬请期待！",
].join("\n");

// 反馈群回复（Markdown 精美版）
const FEEDBACK_MARKDOWN = [
  "## 💬 **反馈建议**",
  "",
  "> *你的每一条建议，都是我们前进的动力*",
  "",
  "---",
  "",
  "📢 欢迎加入**机器人反馈群**：",
  "",
  "👥 **QQ群号：`" + FEEDBACK_GROUP_ID + "`**",
  "",
  "在群里告诉我们：",
  "- 🐛 遇到的 Bug",
  "- 💡 功能建议",
  "- ❓ 使用疑问",
  "",
  "---",
  "",
  "💡 *在QQ中搜索群号即可加入*",
].join("\n");

// ===== 可扩展：你的机器人回复逻辑 =====
// 返回 { text, markdown, keyboard } 三种之一；按开关决定实际发送哪种
function buildReply(content) {
  const text = (content || "").trim();
  const low = text.toLowerCase();

  // 菜单/帮助
  if (["菜单", "帮助", "help", "功能", "功能菜单"].includes(low)) {
    if (ENABLE_BUTTON) return buildButtonMenu();
    if (ENABLE_MARKDOWN) return { markdown: MENU_MARKDOWN };
    return MENU_TEXT;
  }

  // 【功能1】访问社群站 —— 返回功能结果（社群站链接），不再返回菜单
  if (
    ["1", "社群站", "社群官网", "访问社群站", "官网", "网站"].includes(low) ||
    text.includes("社群站")
  ) {
    if (ENABLE_MARKDOWN) return { markdown: SITE_MARKDOWN };
    return SITE_TEXT;
  }

  // 【功能2】查询EC社群 —— 占位（下午接入 Turso 后完善）
  if (["2", "查EC社群", "查询EC社群", "EC社群", "社群数据"].includes(low) || text.includes("EC社群")) {
    if (ENABLE_MARKDOWN) {
      return {
        markdown: [
          "## 🔍 **查询EC社群**",
          "",
          "> 🚧 *功能开发中...*",
          "",
          "---",
          "",
          "该功能正在接入社群数据，",
          "预计**下午**可用。",
          "",
          "✨ 敬请期待！",
        ].join("\n"),
      };
    }
    return [
      "🔍 查询EC社群功能开发中...",
      "",
      "该功能正在接入社群数据，预计下午可用。",
      "敬请期待！",
    ].join("\n");
  }

  // 【功能3】反馈建议 —— 展示反馈群信息
  if (["3", "反馈", "反馈群", "建议", "反馈建议", "意见"].includes(low) || text.includes("反馈")) {
    if (ENABLE_MARKDOWN) return { markdown: FEEDBACK_MARKDOWN };
    return [
      "💬 欢迎加入机器人反馈群！",
      "",
      "👥 QQ群号：" + FEEDBACK_GROUP_ID,
      "",
      "在群里可以告诉我们：",
      "· 遇到的 Bug",
      "· 功能建议",
      "· 使用疑问",
      "",
      "💡 在QQ中搜索群号即可加入。",
    ].join("\n");
  }

  // 基本问候
  if (["你好", "hi", "hello", "嗨", "您好"].includes(low)) {
    return "你好呀！👋 发送「菜单」可查看我能做什么。";
  }
  if (text.includes("你是谁") || text.includes("介绍")) {
    return "我是由 DeepSeek Harness 帮你部署的 QQ 机器人，通过官方 WebSocket 网关实时在线。发送「菜单」查看功能列表。";
  }
  if (["ping", "测试", "在吗"].includes(low)) {
    return "pong！🏓 我在线，回复正常。发送「菜单」查看功能。";
  }
  if (text.includes("时间") || text.includes("几点")) {
    return "现在时间：" + new Date().toLocaleString("zh-CN");
  }
  return `收到你的消息："${text}"\n发送「菜单」查看我能做什么。`;
}

// 进群开场白（精美 Markdown）
function buildWelcome() {
  return {
    markdown: [
      "## 👋 **大家好！我是 EC社群机器人**",
      "",
      "> *很高兴加入这个群！*",
      "",
      "---",
      "",
      "我是本群的智能助手，可以帮你：",
      "",
      "**1️⃣ 访问社群站** — 🌐 打开社群自治官网",
      "",
      "**2️⃣ 查询EC社群** — 🔍 社群数据查询（开发中）",
      "",
      "**3️⃣ 反馈建议** — 💬 加入反馈群",
      "",
      "---",
      "",
      "💡 *发送「菜单」或点击下方按钮即可使用*",
    ].join("\n"),
    keyboard: {
      content: {
        rows: [
          {
            buttons: [
              {
                id: "w1",
                render_data: { label: "🌐 访问社群站", style: 1 },
                action: { type: 1, data: "site", permission: { type: 2 } },
              },
              {
                id: "w2",
                render_data: { label: "🔍 查询EC社群", style: 1 },
                action: { type: 1, data: "ec", permission: { type: 2 } },
              },
            ],
          },
          {
            buttons: [
              {
                id: "w3",
                render_data: { label: "💬 反馈建议", style: 1 },
                action: { type: 1, data: "feedback", permission: { type: 2 } },
              },
            ],
          },
        ],
      },
    },
  };
}

// ===== 主逻辑 =====
// 统一处理 buildReply 的返回值：字符串 或 { markdown } / { keyboard }
function toSendParams(reply, msgId) {
  if (typeof reply === "string") return { content: reply, msgId };
  if (reply && typeof reply === "object") {
    return Object.assign({ msgId }, reply); // { markdown } 或 { keyboard }
  }
  return { content: String(reply ?? ""), msgId };
}

const gateway = new QQBotGateway({
  log: {
    log: (...a) => console.log(new Date().toLocaleTimeString(), ...a),
    error: (...a) => console.error(new Date().toLocaleTimeString(), "ERR", ...a),
  },
  onReady: () => {
    console.log("\n===================");
    console.log("🤖 机器人已上线！");
    console.log("   AppID:", process.env.QQ_APP_ID);
    console.log("   等待消息中... (Ctrl+C 停止)");
    console.log("===================\n");
  },
  onEvent: async (eventName, d) => {
    try {
      if (eventName === "GROUP_ADD_ROBOT") {
        // 机器人被拉进群 → 发送开场白
        const groupOpenid = d.group_openid;
        if (!groupOpenid) return;
        console.log(`[进群] 🤖 被拉入群 ${groupOpenid}`);
        const welcome = buildWelcome();
        await sendGroupMessage(groupOpenid, toSendParams(welcome, null));
        console.log(`[进群] ✅ 开场白已发送`);
        return;
      }
      if (eventName === "INTERACTION_CREATE") {
        // 按钮点击事件 → 自动回复对应功能
        const interactionId = d.id;
        // 按钮数据在 data.resolved 里（官方文档的字段是 data.button_data，实际在 resolved 中）
        const buttonData = d.data?.resolved?.button_data;
        const buttonId = d.data?.resolved?.button_id;
        // 场景用 scene 判断（chat_type 的 1 可能是群，不可靠）
        const scene = d.scene; // "c2c" 或 "group"
        console.log(`[按钮] 点击: ${buttonData || buttonId} (scene=${scene})`);

        // 先回应交互，避免客户端一直 loading
        if (interactionId) {
          try {
            await replyInteraction(interactionId);
          } catch (e) {
            console.error(`回应交互失败:`, e.message);
          }
        }

        // 根据按钮 data 自动回复
        let reply = null;
        if (buttonData === "site" || buttonId === "1" || buttonId === "w1" || buttonId === "t1") {
          reply = { markdown: SITE_MARKDOWN };
        } else if (buttonData === "ec" || buttonId === "2" || buttonId === "w2" || buttonId === "t2") {
          reply = { markdown: EC_MARKDOWN };
        } else if (buttonData === "feedback" || buttonId === "3" || buttonId === "w3") {
          reply = { markdown: FEEDBACK_MARKDOWN };
        }
        if (!reply) return;

        if (scene === "c2c") {
          const openid = d.user_openid || d.group_member_openid;
          if (openid) await sendC2CMessage(openid, toSendParams(reply, null));
        } else {
          const groupOpenid = d.group_openid;
          if (groupOpenid) await sendGroupMessage(groupOpenid, toSendParams(reply, null));
        }
        console.log(`[按钮] ✅ 已自动回复`);
        return;
      }
      if (eventName === "C2C_MESSAGE_CREATE") {
        // 私聊消息
        const openid = d.author?.user_openid;
        const content = d.content;
        const msgId = d.id;
        if (!openid) return;
        console.log(`[私聊] ${openid}: ${content}`);
        const reply = buildReply(content);
        await sendC2CMessage(openid, toSendParams(reply, msgId));
        console.log(`[私聊] ✅ 已回复 ${openid}`);
      } else if (eventName === "GROUP_AT_MESSAGE_CREATE") {
        // 群聊@消息
        const groupOpenid = d.group_openid;
        const content = d.content;
        const msgId = d.id;
        if (!groupOpenid) return;
        console.log(`[群聊@] ${groupOpenid}: ${content}`);
        const reply = buildReply(content);
        await sendGroupMessage(groupOpenid, toSendParams(reply, msgId));
        console.log(`[群聊@] ✅ 已回复`);
      }
    } catch (e) {
      console.error("处理事件失败:", e.message);
    }
  },
});

// 优雅退出
process.on("SIGINT", () => {
  console.log("\n正在断开连接...");
  gateway.disconnect();
  process.exit(0);
});

gateway.start().catch((e) => {
  console.error("启动失败:", e.message);
  process.exit(1);
});
