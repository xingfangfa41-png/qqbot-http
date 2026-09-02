# 🚀 云服务器部署指南（让机器人 7×24 小时在线不掉线）

本项目的机器人代码**零 npm 依赖**（只用 Node.js 内置模块），部署到服务器只需三步：
装 Node.js → 拷代码 → 跑起来。

---

## 一、买服务器（推荐配置）

| 项目 | 推荐 |
|------|------|
| 厂商 | 腾讯云轻量 / 阿里云轻量（学生机更便宜） |
| 系统 | **Ubuntu 22.04** 或 Debian 11（Linux 均可） |
| 配置 | 最低 **1核1G** 即可（机器人很轻量） |
| 价格 | 约 ¥10~30/月，新用户常有首年优惠 |

> 💡 轻量应用服务器（Lighthouse）比云服务器 CVM 更便宜、更简单，适合个人用。

---

## 二、连接服务器

买好后，用 SSH 连接（Windows 用 PowerShell/CMD 自带 ssh，Mac/Linux 用终端）：

```bash
ssh root@你的服务器公网IP
```

输入你设置的密码即可登录。

---

## 三、装 Node.js（一次性）

登录后执行（Ubuntu/Debian 通用）：

```bash
# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 验证
node -v   # 应显示 v20.x.x
```

> 本项目要求 Node 16+，装 20 最稳妥。

---

## 四、上传代码

### 方法 A：直接用 SCP 上传（推荐）

在**你本地电脑**（不是服务器）执行，把 `qqbot-http` 文件夹传上去：

```bash
# 在本地项目目录的上级目录执行
scp -r qqbot-http root@服务器IP:/root/
```

### 方法 B：用 Git

如果你把代码传到 GitHub/Gitee 仓库，服务器上：

```bash
git clone 你的仓库地址
```

### 方法 C：手动粘贴

如果代码量小，也可以在服务器上用 `nano bot.js` 逐个创建文件粘贴（不推荐，太繁琐）。

---

## 五、配置凭证

上传后，在服务器上：

```bash
cd /root/qqbot-http
cp .env.example .env      # 如果没有 .env 的话
nano .env                 # 编辑，填入你的 AppID / AppSecret
```

`.env` 内容：
```
QQ_APP_ID=1905545392
QQ_APP_SECRET=j6UsHg6WxOqIlEiChDjGnLtS1bBmO1eI
```

保存：`Ctrl+O` 回车，退出：`Ctrl+X`。

---

## 六、先测试跑一次

```bash
cd /root/qqbot-http
node bot.js
```

看到 `🤖 机器人已上线！` 就成功了。`Ctrl+C` 停止。

---

## 七、让机器人永久后台运行（关键！）

直接 `node bot.js` 会在你断开 SSH 后停止。要用**进程守护**让它在后台常驻：

### 方法 A：pm2（推荐，最常用）

```bash
# 全局安装 pm2
npm install -g pm2

# 启动机器人（pm2 会守护它，崩了自动重启）
cd /root/qqbot-http
pm2 start bot.js --name qqbot

# 设置开机自启
pm2 startup
pm2 save
```

常用命令：
```bash
pm2 status          # 查看状态
pm2 logs qqbot      # 查看日志
pm2 restart qqbot   # 重启
pm2 stop qqbot      # 停止
```

### 方法 B：systemd（无需额外工具，更底层）

创建服务文件：
```bash
nano /etc/systemd/system/qqbot.service
```

写入：
```ini
[Unit]
Description=QQ Bot
After=network.target

[Service]
WorkingDirectory=/root/qqbot-http
ExecStart=/usr/bin/node /root/qqbot-http/bot.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用：
```bash
systemctl daemon-reload
systemctl enable qqbot
systemctl start qqbot
systemctl status qqbot   # 查看状态
```

---

## 八、验证

部署完成后，在服务器上看日志确认运行正常：

```bash
pm2 logs qqbot        # pm2 方式
# 或
journalctl -u qqbot -f   # systemd 方式
```

然后在 QQ 里 @机器人测试。从此**手机关机、重启都不影响**，机器人永远在线。

---

## 九、更新代码

以后改了 bot.js，重新上传后重启：

```bash
pm2 restart qqbot     # pm2 方式
# 或
systemctl restart qqbot   # systemd 方式
```

---

## 常见问题

| 问题 | 解决 |
|------|------|
| `node: command not found` | 没装 Node，回到第三步 |
| 连不上服务器 | 检查服务器防火墙是否放行 22 端口；确认公网 IP 正确 |
| 机器人上线但收不到消息 | 确认 QQ 开放平台里机器人已审核/沙箱成员已添加 |
| 想换一台服务器 | 重复第四~七步即可，代码和 .env 拷过去就行 |
