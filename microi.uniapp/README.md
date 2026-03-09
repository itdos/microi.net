# Microi吾码 - 多端小程序（WebView 模式）

## 项目说明

本项目是 [Microi.net](https://github.com/user/Microi.net) 低代码平台的小程序 / App 端，采用 **uni-app (Vue 3 + Vite)** 开发。  
支持编译为**微信、支付宝、抖音、飞书、小红书小程序**以及 **App**，一套代码多端运行。  
用户在小程序内完成登录后，通过 WebView 加载 PC/移动端 H5 页面（`microi.web`），实现完整的移动办公与业务体验。

## 功能特性

- **多平台授权登录**：微信 / 支付宝 / 抖音 / 飞书 / 小红书小程序一键授权登录
- **账号密码登录**：支持传统登录方式，密码 RSA 加密传输
- **验证码支持**：根据系统配置自动开启图形验证码
- **WebView 工作台**：登录后通过 WebView 加载 `microi.web` 实现免二次登录访问
- **商城 / 资讯 / 消息**：内置商城、新闻资讯、即时消息（SignalR）等原生页面
- **Token 自动续期**：每次打开 App / 小程序自动调用 RefreshToken 实现长期免登录
- **多语言**：内置 vue-i18n 国际化支持
- **隐私协议**：内置隐私政策页面，满足各平台审核要求

## 项目结构

```
microi.uniapp/
├── src/
│   ├── config.js              # ⚠️ 项目配置文件（接口地址、WebView地址、OsClient等）
│   ├── App.vue                # 应用入口（Token自动续期）
│   ├── main.js                # 主入口
│   ├── pages.json             # 路由 & TabBar 配置
│   ├── manifest.json          # uni-app 平台配置（AppID等）
│   ├── uni.scss               # 全局样式变量
│   ├── pages/                 # 页面目录
│   │   ├── mall/              # 商城（首页 + 详情）
│   │   ├── news/              # 资讯（列表 + 详情）
│   │   ├── workspace/         # 工作台（菜单 → WebView）
│   │   ├── message/           # 消息（列表 + 聊天）
│   │   ├── profile/           # 个人中心
│   │   ├── login/             # 登录页
│   │   ├── webview/           # WebView 容器
│   │   ├── privacy/           # 隐私政策
│   │   └── about/             # 关于我们
│   ├── utils/                 # 工具模块
│   │   ├── request.js         # 网络请求封装（Token自动注入）
│   │   ├── api.js             # 业务接口
│   │   ├── crypto.js          # RSA 加密
│   │   ├── platform.js        # 多平台检测（source标识、登录方式等）
│   │   ├── i18n.js            # 国际化
│   │   ├── sysconfig.js       # 系统配置读取
│   │   ├── signalr.js         # SignalR 即时通讯
│   │   └── theme.js           # 主题色
│   └── static/                # 静态资源（Logo、TabBar图标等）
├── package.json
└── vite.config.js             # Vite配置（含小程序加密库兼容插件）
```

## 开始使用

### 1. 安装依赖

```bash
cd microi.uniapp
npm install
```

### 2. 修改配置

编辑 `src/config.js`，根据实际环境修改：

```javascript
export default {
  // 后端接口地址
  apiBase: 'https://your-api-domain.com',

  // WebView 加载地址（即 microi.web 部署地址）
  webviewUrl: 'https://your-h5-domain.com',

  // OsClient 标识（对应后端多租户标识）
  osClient: 'your-osclient',

  // 各平台授权登录接口（按需配置）
  platformLoginApis: {
    weixin: '/apiengine/wx-miniprogram-login-reg-bind',
    alipay: '/apiengine/alipay-miniprogram-login-reg-bind',
    // ...
  },

  // RSA 公钥（与后端一致）
  publicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'
}
```

### 3. 平台配置

在对应平台的开发者后台（如[微信公众平台](https://mp.weixin.qq.com/)）：

1. 在 `manifest.json` 中填入小程序 **AppID**
2. 将 `apiBase` 添加到 **request 合法域名**
3. 将 `webviewUrl` 添加到 **业务域名**（WebView 必需）

### 4. 开发运行

```bash
# 微信小程序
npm run dev:mp-weixin

# 支付宝小程序
npm run dev:mp-alipay

# 抖音小程序
npm run dev:mp-toutiao

# 飞书小程序
npm run dev:mp-lark

# 小红书小程序
npm run dev:mp-xhs

# App
npm run dev:app
```

以微信为例，使用微信开发者工具打开 `dist/dev/mp-weixin` 目录即可预览。

### 5. 构建发布

```bash
npm run build:mp-weixin
npm run build:mp-alipay
npm run build:mp-toutiao
npm run build:mp-lark
npm run build:mp-xhs
npm run build:app
```

## 审核注意事项

1. **业务域名**：WebView 加载的 H5 地址必须在对应平台后台配置为业务域名
2. **隐私协议**：已内置隐私政策页面，请根据实际情况修改内容
3. **Logo 替换**：将 `src/static/` 下的图标替换为正式资源
4. **隐私保护指引**：在平台后台填写隐私保护指引，声明使用的用户隐私接口

## 技术栈

- **框架**：uni-app (Vue 3.4 + Vite 5)
- **加密**：encryptlong (RSA)
- **国际化**：vue-i18n 9
- **即时通讯**：SignalR
- **目标平台**：微信 / 支付宝 / 抖音 / 飞书 / 小红书小程序、App

## 许可协议

与 Microi.net 主项目保持一致。
