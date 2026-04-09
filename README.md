This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## 🤖 飞书机器人配置指南 (Feishu Bot Setup Guide)

本项目支持通过飞书机器人直接发送链接（B站、推特、网页等），自动解析并保存到你的时间线。以下是详细的配置步骤：

### 1. 创建飞书自建应用
1. 访问 [飞书开放平台开发者后台](https://open.feishu.cn/app) 并登录。
2. 点击 **“创建企业自建应用”**，填写应用名称（如：LinkSaver Bot）和应用描述，然后点击创建。

### 2. 获取凭证 (Credentials)
1. 在左侧菜单找到 **“凭证与基础信息”**。
2. 复制你的 **App ID** 和 **App Secret**。
3. 将它们填入你服务器（或 Vercel）的环境变量中：
   - `FEISHU_APP_ID=你的AppID`
   - `FEISHU_APP_SECRET=你的AppSecret`

### 3. 添加机器人能力
1. 在左侧菜单找到 **“添加应用能力”**。
2. 找到 **“机器人”** 并点击添加。这使得你的应用可以作为一个实体在飞书中出现。

### 4. 申请接口权限
飞书的权限管控非常严格，机器人需要收发消息的权限：
1. 左侧菜单进入 **“权限管理”**。
2. 搜索并勾选以下权限：
   - `接收单聊消息` (im:message.p2p_msg:readonly 或 im:message:receive_as_bot)
   - `接收群聊消息` (im:message.group_msg:readonly) （如果需要拉群使用）
   - `获取单聊、群组消息` (im:message:readonly)
   - `给多个用户发送消息` / `给用户发单聊消息` (im:message:send_as_bot)
3. 申请并完成权限审批（如果是管理员，可以直接通过）。

### 5. 配置事件订阅 (Webhook) 💡 **关于内网穿透的解答**
> **常见问题：一定要配置内网穿透 (如 ngrok) 吗？**
> **不需要！** 如果你只是想把它部署到线上使用，完全不需要本地内网穿透。你可以按照以下步骤直接在 Vercel 等平台完成验证：

1. **先部署代码：** 确保本项目的最新代码（包含 `/api/webhooks/feishu` 路由）已经部署到了你的公网服务器或 Vercel。
2. **设置 Token：** 在飞书后台 **“事件订阅”** 页面，你会看到一个 **Verification Token**（如果没有，可以点击重置生成一个）。
3. **配置线上环境变量：** 把这个 Token 复制下来，去到你的 Vercel 控制台 -> Settings -> Environment Variables，添加 `FEISHU_VERIFICATION_TOKEN=你的Token`。并且确保 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 也已配置。
4. **重新部署 (Redeploy)：** 在 Vercel 重新部署一次，让环境变量生效。
5. **在飞书填写请求地址：** 回到飞书开发者后台的 **“事件订阅”**，在请求地址 (请求 URL) 中填入你部署后的公网地址，例如：
   `https://your-domain.vercel.app/api/webhooks/feishu`
6. **保存验证：** 点击保存。飞书会向该地址发送一个 `url_verification` 的请求，因为我们已经在 Vercel 配置了代码和 Token，验证会瞬间通过！

### 6. 订阅具体事件
配置完 Webhook 地址后，在“事件订阅”页面下方找到 **“添加事件”**：
1. 搜索并添加 `接收消息 v2.0` (im.message.receive_v1) 事件。
2. 保存设置。

### 7. 发布版本
1. 在左侧菜单找到 **“版本管理与发布”**。
2. 点击 **“创建版本”**，随便填一个版本号（如 `1.0.0`），并填写更新说明。
3. 提交申请并发布。

### 🎉 大功告成！
现在你可以打开飞书，在搜索框搜索你刚才创建的机器人名称，跟它打个招呼，然后粘贴一个 URL 发送给它。如果配置正确，它会自动抓取网页信息、保存到数据库，并回复你 **"Saved to timeline!"**。
