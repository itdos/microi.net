# r-utils

`r-utils` 封装了`lodash`、`dayjs`以及其他常用的方法。

## API

| 名称         | 说明             | 示例                                       |
| ------------ | ---------------- | ------------------------------------------ |
| \_           | lodash 的对象    | \_.cloneDeep()                             |
| dayjs        | dayjs 的对象     | dayjs().valueof()                          |
| GetRect      | 查询节点对象     | GetRect(className, this, true)             |
| isNumeric    | 判断是否是数字   | isNumeric(1)//true isNumeric('sss')//false |
| SplitUnitNum | 分割数字值和单位 | const {num,unit} = SplitUnitNum（str）     |

更多组件，请前往[rainui](https://ext.dcloud.net.cn/plugin?id=19701)