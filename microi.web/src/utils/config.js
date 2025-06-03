// 默认配置
const defaultConfig = {
  apiBaseUrl: process.env.VUE_APP_API_BASEURL || 'https://api.nbweixin.cn' // 你的默认接口地址
};

// 尝试加载配置文件
let config = { ...defaultConfig };

try {
  // 使用 require.context 或直接 require 来加载 JSON 文件
  const context = require.context('../', false, /localConfig\.json$/);
  if (context.keys().length) {
    const customConfig = context('./localConfig.json');
    config = { ...defaultConfig, ...customConfig };
  }
} catch (e) {
  console.warn('Failed to load config.json, using default configuration:', e.message);
}

export default config;