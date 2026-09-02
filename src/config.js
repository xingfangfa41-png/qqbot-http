// 轻量环境变量加载器：读取同级 .env（不依赖 dotenv 包，兼容任意 Node 版本）
const fs = require("fs");
const path = require("path");

function loadEnv(file = ".env") {
  const envPath = path.join(__dirname, "..", file);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue; // 跳过空行与注释
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      // 去掉首尾引号
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const config = {
  appID: process.env.QQ_APP_ID || "",
  appSecret: process.env.QQ_APP_SECRET || "",
};

if (!config.appID || !config.appSecret) {
  console.error(
    "[config] 缺少 QQ_APP_ID 或 QQ_APP_SECRET，请先复制 .env.example 为 .env 并填写。"
  );
  process.exit(1);
}

module.exports = config;
