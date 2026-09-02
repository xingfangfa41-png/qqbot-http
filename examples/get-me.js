// 示例：验证凭证 & 获取机器人信息
// 用法（在能联网的机器上）: node examples/get-me.js
const { getMe } = require("../src/client");

async function main() {
  console.log("🔑 正在获取 access_token 并验证凭证...");
  const res = await getMe();
  console.log("✅ 机器人信息:");
  console.log(JSON.stringify(res.body, null, 2));
}

main().catch((e) => {
  console.error("❌ 失败:", e.message);
  process.exit(1);
});
