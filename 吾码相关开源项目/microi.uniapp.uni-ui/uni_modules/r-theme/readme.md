# r-theme

`r-theme` 是一个为 `r-overlay` `r-icon` 等组件提供定制样式的 jssdk。

[在线示例](https://rainui.cn/h5/index.html#/) [完整文档](https://rainui.cn/) [完整文档](https://irainna.github.io/rainui/)

## API

| 名称                    | 说明                          | 参数                                      | 返回值                      |
| ----------------------- | ----------------------------- | ----------------------------------------- | --------------------------- |
| getThemeCssVar          | 获取主题的所有的 css 变量     | name //主题名称                           | 所有 css 变量组成的对象     |
| getComponentThemeCssVar | 获取主题的指定组件的 css 变量 | (name,componentName) //主题名称 ,组件名称 | 指定组件 css 变量组成的对象 |
