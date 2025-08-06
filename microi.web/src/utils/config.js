// 默认配置
const defaultConfig = {
  apiBaseUrl: process.env.VUE_APP_API_BASEURL || 'https://api.nbweixin.cn' // 你的默认接口地址
};

// 开发环境使用本地地址
const isDevelopment = process.env.NODE_ENV === 'development';

// 尝试加载配置文件
let config = { ...defaultConfig };

// 开发环境优先使用本地配置
if (isDevelopment) {
  try {
    const customConfig = require('../localConfig.json');
    console.log('localConfig loaded:', customConfig);
    config = { ...defaultConfig, ...customConfig };
  } catch (e) {
    console.warn('Failed to load localConfig.json, using hardcoded local config');
    // 如果加载失败，使用硬编码的本地配置
    config = {
      ...defaultConfig,
      apiBaseUrl: 'https://api.nbweixin.cn'
    };
  }
}

console.log('Final config:', config);

export default config;
