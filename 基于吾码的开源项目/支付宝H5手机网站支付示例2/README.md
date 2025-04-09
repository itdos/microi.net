

## 1.解压下载的压缩包，将组件放在项目的components目录下

## 2.引用组件
```
import lzcKeyboard from "@/components/lzc-keyboard/lzc-keyboard.vue";
export default {
	components: {
		lzcKeyboard,
	}
}
<cu-keyboard ref="cukeyboard" :defaultValue='defaultValue' confirmText='确定' :confirmStyle='confirmStyle' @change="change" @confirm="confirm" @hide="hide"></cu-keyboard>
```




## 3.字段解释
```
confirmStyle  // 付款按钮背景颜色
defaultValue //默认值
expense  // 输完之后的值
confirmText  // 付款按钮文字
更多字段解释 请查看示例项目，有详细注释
```


### 业务微信 liuzichen0539



