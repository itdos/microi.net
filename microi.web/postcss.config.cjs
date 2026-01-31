module.exports = {
  plugins: {
    // 自动添加浏览器前缀，确保开发和生产环境一致
    autoprefixer: {
      overrideBrowserslist: [
        '> 1%',
        'last 2 versions',
        'not dead',
        'not ie 11'
      ]
    }
  }
}
