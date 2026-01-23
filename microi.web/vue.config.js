"use strict";
//项目开发用！！！
//这个文件其实就是webpack.config.js
const path = require("path");
const defaultSettings = require("./src/settings.js");
var webpack = require("webpack");

function resolve(dir) {
  return path.join(__dirname, dir);
}

const name = defaultSettings.title || "Loading..."; // page title
//以下为MonacoEditor需要
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
//----

// If your port is set to 80,
// use administrator privileges to execute the command line.
// For example, Mac: sudo npm run
// You can change the port by the following method:
// port = 9527 npm run dev OR npm run dev --port = 9527
const port = process.env.port || process.env.npm_config_port || 1988; // dev port
const NODE_ENV = process.env.NODE_ENV;
// All configuration item explanations can be find in https://cli.vuejs.org/config/
module.exports = {
  // optimization:{
  //   minimize:true
  // },
  // entry: {//by itdos.com
  //   'microi.net': NODE_ENV == 'development' ? './src/main.js' : './index.js',
  // },
  // filename: 'microi.net.js',
  css: {
    extract: false
  },
  /**
   * You will need to set publicPath if you plan to deploy your site under a sub path,
   * for example GitHub Pages. If you plan to deploy your site to https://foo.github.io/bar/,
   * then publicPath should be set to "/bar/".
   * In most cases please use '/' !!!
   * Detail: https://cli.vuejs.org/config/#publicpath
   */
  publicPath: "./",
  outputDir: "dist/itdos.os/dist",
  assetsDir: "static",
  lintOnSave: process.env.NODE_ENV === "development",
  productionSourceMap: false,

  devServer: {
    // watchOptions 在 webpack5 中已移除，使用 watchFiles 替代
    host: 'localhost',
    port: port,
    open: true,
    client: {
      overlay: {
        warnings: false,
        errors: true
      }
    }
    // before: require('./mock/mock-server.js')
  },
  configureWebpack: (config) => {
    // 使用 NormalModuleReplacementPlugin 让 element-plus 使用原生 Vue 3
    // 而应用代码使用 @vue/compat
    const NormalModuleReplacementPlugin = webpack.NormalModuleReplacementPlugin;
    
    config.devtool = "source-map"; // 开发环境使用 source-map
    config.name = name;
    
    // 配置 resolve
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": resolve("src"),
      // 默认使用 @vue/compat
      vue: "@vue/compat"
    };
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      path: require.resolve("path-browserify"),
      timers: require.resolve("timers-browserify")
    };
    
    // 配置 plugins
    config.plugins = config.plugins || [];
    
    // 让 element-plus 使用原生 Vue 3 而不是 @vue/compat
    config.plugins.push(
      new NormalModuleReplacementPlugin(
        /^vue$/,
        function(resource) {
          // 如果请求来自 element-plus，使用原生 vue
          if (resource.context && resource.context.includes('element-plus')) {
            resource.request = require.resolve('vue').replace('/dist/vue.runtime.esm-bundler.js', '');
          }
        }
      )
    );
    
    config.plugins.push(
      new MonacoWebpackPlugin({
        // 支持的语言（TypeScript 是 JavaScript 智能提示的必需项）
        languages: ["javascript", "typescript", "json"],
        // 包含所有编辑器功能
        features: [
          'bracketMatching',
          'caretOperations',
          'clipboard',
          'codelens',
          'colorDetector',
          'comment',
          'contextmenu',
          'coreCommands',
          'cursorUndo',
          'dnd',
          'find',
          'folding',
          'fontZoom',
          'format',
          'gotoError',
          'gotoLine',
          'gotoSymbol',
          'hover',
          'inPlaceReplace',
          'indentation',
          'inlayHints',
          'inlineCompletions',
          'inspectTokens',
          'iPadShowKeyboard',
          'linesOperations',
          'linkedEditing',
          'links',
          'multicursor',
          'parameterHints',
          'quickCommand',
          'quickOutline',
          'referenceSearch',
          'rename',
          'smartSelect',
          'snippets',
          'suggest',
          'toggleHighContrast',
          'toggleTabFocusMode',
          'transpose',
          'unusualLineTerminators',
          'viewportSemanticTokens',
          'wordHighlighter',
          'wordOperations',
          'wordPartOperations'
        ]
      })
    );
    
    // Vue 3 兼容模式：定义特性标志
    config.plugins.push(
      new webpack.DefinePlugin({
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
      })
    );
    //-----end
  },
  chainWebpack(config) {
    // Vue 3 兼容模式配置
    config.module
      .rule('vue')
      .use('vue-loader')
      .tap((options) => {
        return {
          ...options,
          compilerOptions: {
            compatConfig: {
              MODE: 2,  // 默认为 Vue 2 行为
              // 禁用会导致 Element Plus IsolatedRenderer 报错的兼容行为
              COMPONENT_FUNCTIONAL: false,
              COMPONENT_ASYNC: false
            }
          }
        };
      });

    // Vue CLI 5 preload 插件配置（如果存在）
    if (config.plugins.has('preload')) {
      config.plugin("preload").tap(() => [
        {
          rel: "preload",
          fileBlacklist: [/\.map$/, /hot-update\.js$/, /runtime\..*\.js$/],
          include: "initial"
        }
      ]);
    }

    // when there are many pages, it will cause too many meaningless requests
    if (config.plugins.has('prefetch')) {
      config.plugins.delete("prefetch");
    }

    // set svg-sprite-loader
    config.module.rule("svg").exclude.add(resolve("src/icons")).end();
    config.module
      .rule("icons")
      .test(/\.svg$/)
      .include.add(resolve("src/icons"))
      .end()
      .use("svg-sprite-loader")
      .loader("svg-sprite-loader")
      .options({
        symbolId: "icon-[name]"
      })
      .end();

    config.when(process.env.NODE_ENV !== "development", (config) => {
      config
        .plugin("ScriptExtHtmlWebpackPlugin")
        .after("html")
        .use("script-ext-html-webpack-plugin", [
          {
            // `runtime` must same as runtimeChunk name. default is `runtime`
            inline: /runtime\..*\.js$/
          }
        ])
        .end();
      config.optimization.splitChunks({
        chunks: "all",
        cacheGroups: {
          libs: {
            name: "chunk-libs",
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            chunks: "initial" // only package third parties that are initially dependent
          },
          elementPlus: {
            name: "chunk-elementPlus", // split element-plus into a single package
            priority: 20, // the weight needs to be larger than libs and app or it will be packaged into libs or app
            test: /[\\/]node_modules[\\/]_?element-plus(.*)/ // in order to adapt to cnpm
          },
          commons: {
            name: "chunk-commons",
            test: resolve("src/components"), // can customize your rules
            minChunks: 3, //  minimum common number
            priority: 5,
            reuseExistingChunk: true
          }
        }
      });
      // https:// webpack.js.org/configuration/optimization/#optimizationruntimechunk
      config.optimization.runtimeChunk("single");
      // config.optimization.minimize(true);
    });
  }
};
