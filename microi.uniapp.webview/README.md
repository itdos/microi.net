# microi.uniapp.webview

Microi.net 低代码平台 - 微信小程序端（WebView 模式）

## 项目说明

本项目是 Microi.net 低代码平台的微信小程序端，采用 **uni-app (Vue 3)** 开发。  
用户通过小程序登录后，以 WebView 方式加载移动端 H5 页面，实现完整的移动办公体验。

## 功能特性

- **微信授权登录**：支持微信小程序一键授权登录（需后端实现对应接口）
- **账号密码登录**：支持传统账号密码登录，密码采用 RSA 加密传输
- **验证码支持**：根据系统配置自动开启图形验证码
- **WebView 工作台**：登录后加载配置的 H5 页面地址
- **隐私协议**：内置隐私政策页面，满足小程序审核要求
- **Token 鉴权**：自动携带 Token 访问 WebView，实现免二次登录

## 项目结构

```
microi.uniapp.webview/
├── pages/
│   ├── login/index.vue      # 登录页面（授权登录 + 账号密码）
│   ├── webview/index.vue     # WebView 工作台页面
│   ├── privacy/index.vue     # 隐私政策页面
│   └── about/index.vue       # 关于我们页面
├── utils/
│   ├── config.js             # 配置文件（⚠️ 需修改）
│   ├── request.js            # 网络请求封装
│   └── crypto.js             # RSA 加密工具
├── static/
│   └── logo.png              # Logo 图片（请替换）
├── App.vue                   # 应用入口
├── main.js                   # 主入口
├── manifest.json             # uni-app 配置
├── pages.json                # 路由配置
├── uni.scss                  # 全局样式变量
└── package.json              # 依赖配置
```

## 开始使用

### 1. 安装依赖

```bash
cd microi.uniapp.webview
npm install
```

### 2. 修改配置

编辑 `utils/config.js`，根据实际环境修改以下配置：

```javascript
const config = {
  // API 接口地址
  apiBase: 'https://your-api-domain.com',
  
  // 登录成功后的 WebView 地址（移动端 H5）
  webviewUrl: 'https://your-h5-domain.com/mobile/home',
  
  // 平台名称
  appName: '您的平台名称',
  
  // ...其他配置
}
```

### 3. 配置微信小程序

1. 在 `manifest.json` 中填入您的微信小程序 AppID
2. 在 [微信公众平台](https://mp.weixin.qq.com/) 配置：
   - **服务器域名**：将 API 地址添加到 `request合法域名`
   - **业务域名**：将 WebView 的 H5 地址添加到 `业务域名`

### 4. 开发运行

```bash
# 微信小程序
npm run dev:mp-weixin
```

使用微信开发者工具打开 `dist/dev/mp-weixin` 目录即可预览。

### 5. 构建发布

```bash
npm run build:mp-weixin
```

## 小程序审核注意事项

为了确保顺利通过小程序审核，请注意以下几点：

1. **业务域名配置**：WebView 加载的 H5 地址必须在微信后台配置为业务域名
2. **隐私协议**：本项目已内置隐私政策页面，请根据实际情况修改内容
3. **Logo 替换**：请将 `static/logo.png` 替换为您的正式 Logo
4. **功能完整性**：确保登录流程可正常走通，WebView 页面可正常访问
5. **类目选择**：根据实际业务选择合适的小程序服务类目
6. **隐私保护指引**：在微信公众平台填写隐私保护指引，声明使用的用户隐私接口
7. **微信登录接口**：需后端实现 `wx.login` code 换取用户信息的接口

## 后端接口说明

### 微信小程序登录接口

需要后端实现以下接口（路径可在 `config.js` 中配置）：

```
POST /apiengine/wx-miniprogram-login-reg-bind

请求参数：
{
  "Code": "wx.login返回的code",
  "OsClient": "xjy"
}

成功响应：
{
  "Code": 1,
  "Data": {
    "Token": "用户Token",
    "Account": "用户账号",
    "Name": "用户名称"
  }
}
```

## 技术栈

- **框架**：uni-app (Vue 3 + Vite)
- **加密**：JSEncrypt (RSA)
- **平台**：微信小程序

## 许可协议

与 Microi.net 主项目保持一致。
