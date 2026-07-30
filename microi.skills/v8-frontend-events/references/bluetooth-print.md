# V8.Print 蓝牙打印运行指南

本参考用于 Microi 前端 V8 的 BLE 标签和小票打印。运行时事实源为
`Microi.Client/src/utils/v8-print.js`，指令方法事实源见
[`bluetooth-print-api.md`](bluetooth-print-api.md)。官网旧业务示例不能作为当前连接语义。

## 目录

- [前端挂载范围](#前端挂载范围)
- [运行环境与能力判断](#运行环境与能力判断)
- [连接与发送语义](#连接与发送语义)
- [最小安全流程](#最小安全流程)
- [批量打印与恢复](#批量打印与恢复)
- [兼容性与当前限制](#兼容性与当前限制)
- [安全边界](#安全边界)
- [实机验收](#实机验收)

## 前端挂载范围

当前主前端有三层真实挂载，均调用幂等的 `initV8Print(V8)`：

| 源码位置 | 覆盖的 V8 场景 |
|---|---|
| `src/utils/diy.common.js` | 通用前端 V8 基础对象和常规按钮流程 |
| `src/views/form-engine/diy-form.vue` | 表单、字段及表单按钮 V8 |
| `src/views/form-engine/diy-table.vue` | 列表、菜单按钮、行按钮等表格 V8 |

因此不要再从租户脚本导入 `tsc.js`、`esc.js` 或自行挂载 `V8.Print`。这些能力只在
Microi 浏览器/5+App 前端 V8 中可用，不属于后端接口引擎、后端表单事件或微信小程序
原生 BLE API。

基础 V8 对象会把同一个 `Print` 状态复制给多个前端 V8 上下文。分包游标、打印份数和
连接引用均为可变状态，所以同一页面的所有打印任务必须共用一条串行队列，不能认为
不同按钮或不同 V8 对象彼此隔离。

## 运行环境与能力判断

| 运行环境 | 当前引擎 | 结论 |
|---|---|---|
| 5+App 打包的 APK/IPA | `plus.bluetooth` | 支持 BLE 扫描、连接和写特征 |
| 存在 `navigator.bluetooth.requestDevice` 的浏览器 | Web Bluetooth | 支持；通常要求安全上下文和用户手势 |
| 其它普通 H5/浏览器 | 无 | `V8.Print` 仍可能存在，但连接页会提示能力不可用 |
| 微信小程序原生 BLE | 不属于此模块 | 需要小程序/UniApp 侧专用实现 |

不要用 `V8.ClientType === 'PC'` 判断蓝牙能力，也不要只检查
`BLEInformation.deviceId`。正确顺序是检查 `V8.Print`、调用 `isConnected()`，再在
用户点击事件中 `await OpenBluetoothPage()`。

浏览器模板、PDF、A4 单据和 Print Engine JSON 属于 `print-engine`；TSC/TSPL 或
ESC/POS 原生字节通过 BLE 写入才属于 `V8.Print`。

## 连接与发送语义

| API | 当前真实语义 |
|---|---|
| `createNew()` | 新建 TSC/TSPL 标签指令构建器 |
| `createNewESC()` | 新建 ESC/POS 小票指令构建器 |
| `OpenBluetoothPage()` | 返回 `Promise<boolean>`；在连接弹窗关闭时解析，值表示关闭时是否有连接信息 |
| `isConnected()` | Web 端检查实时 GATT 与写特征；5+App 端只检查已保存的设备/写特征 ID |
| `prepareSend(bytes)` | 未连接时先打开连接页，然后按包串行写入；必须 `await` 并捕获失败 |
| `Send(bytes)` | 依赖 `prepareSend` 已设置的内部游标，属于内部状态机入口，业务代码不要直接调用 |
| `setOneTimeData(bytes)` | 设置 BLE 包长；源码不校验，内置候选为 20–190、步长 10，默认 20 |
| `setPrinterNum(num)` | 重复发送同一缓冲区；源码不校验，内置候选为整数 1–9 |
| `disconnect()` | 主动断开并清理当前设备、写特征和会话元数据 |
| `BLEInformation` | 最近设备/服务/特征元数据，只用于诊断，不代表实时连接或打印回执 |

`OpenBluetoothPage()` 已打开时再次调用会返回 `false`。它不是“连接成功事件”；用户连上
设备后仍要关闭弹窗，调用方才能继续。`prepareSend` 虽会自动打开连接页，但业务按钮主动
建立连接更容易给出清晰提示。

连接元数据会写入 `sessionStorage`，但当前 `restoreBLEInfo()` 没有进入初始化调用链，页面
刷新后不会自动恢复可发送的 GATT/特征引用。刷新、跨页面重建或断线后应重新连接。
5+App 的 `isConnected()` 只验证 ID 是否存在，因此发送仍可能因物理断线失败。

## 最小安全流程

```javascript
function cleanCommandText(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\r\n"\x00-\x1f]/g, ' ')
    .slice(0, maxLength || 120);
}

async function ensurePrinterConnected() {
  if (!V8.Print) throw new Error('当前前端未加载蓝牙打印能力');
  if (V8.Print.isConnected()) return;

  var connected = await V8.Print.OpenBluetoothPage();
  if (!connected || !V8.Print.isConnected()) {
    throw new Error('未连接蓝牙打印机');
  }
}

async function printLabel(order) {
  await ensurePrinterConnected();

  var cmd = V8.Print.createNew();
  cmd.setSize(60, 40);
  cmd.setGap(2);
  cmd.setSpeed(4);
  cmd.setDensity(8);
  cmd.setDirection(1);
  cmd.setCls();
  cmd.setText(20, 20, 'TSS24.BF2', 1, 1, cleanCommandText(order.Name, 40));
  cmd.setBarCode(20, 80, '128', 60, 1, 2, 2, cleanCommandText(order.Code, 40));
  cmd.setQR(340, 30, 'L', 5, 'A', cleanCommandText(order.Id, 120));
  cmd.setPagePrint();

  await V8.Print.prepareSend(cmd.getData());
}
```

ESC/POS 小票使用 `createNewESC()`，完整顺序和 25 个真实方法见
[`bluetooth-print-api.md`](bluetooth-print-api.md)。发送成功只表示 BLE 写调用完成，不能
写成“打印机已走纸”或“物理打印成功”。当前源码虽发现 read/notify 特征，但没有订阅状态
通知，也没有消费 ACK、缺纸或故障回执。

## 批量打印与恢复

```javascript
async function printBatch(rows, startIndex) {
  var list = Array.isArray(rows) ? rows : [];
  var begin = Math.max(0, Number(startIndex || 0));
  var limit = Math.min(list.length, begin + 100);

  for (var i = begin; i < limit; i++) {
    try {
      await printLabel(list[i]);
      V8.Tips('已发送 ' + (i + 1) + '/' + list.length, true);
    } catch (error) {
      return {
        Code: 0,
        Msg: '第 ' + (i + 1) + ' 条发送失败：' + (error.message || error),
        NextIndex: i
      };
    }
  }

  return { Code: 1, Data: { NextIndex: limit, HasMore: limit < list.length } };
}
```

- 不用固定 `setTimeout(3000)` 猜测上一张是否完成。
- 不用 `Promise.all`，也不要让两个按钮同时调用 `prepareSend`。
- 大批次分段并持久化 `NextIndex`；页面关闭、断连或写失败后从失败位置人工确认再恢复。
- `setPrinterNum(n)` 只适合同一缓冲区重复发送，不适合每张内容不同的批次。
- 业务落库与蓝牙打印不是原子事务。用稳定业务单号支持受控重打，不重复执行业务写入。

## 兼容性与当前限制

- Web Bluetooth 仅把四个常见服务 UUID 传入 `optionalServices`：`18f0`、`ff00`、
  `49535343-fe7d-4ae5-8fa9-9fafd205e455`、`e7810a71-73ae-499d-8c15-faa9aef0c3f2`。
  当前没有公开的自定义服务配置，并选择枚举到的第一个可写特征；其它型号可能需要扩展源码。
- `prepareSend` 默认每包 20 字节、包间约 20ms；同一缓冲区多份打印间约 100ms。这只是
  BLE 写节奏，不是打印完成等待时间。包长必须是已实测的正整数，空缓冲区不得发送。
- 当前分包公式是 `floor(length / packetSize) + 1`。长度恰好整除包长时会尝试额外写一个
  0 字节末包；某些 BLE 栈会拒绝。实机出现此问题时应修复适配器并回归，不要靠并发或吞错绕过。
- TSC 与 ESC 文本使用仓库内置 `encoding.js` + `encoding-indexes.js` 转为 GB18030，运行时
  不请求网络。编码成功不等于打印机字体、代码页和固件支持全部字符；Emoji 等仍需实机验证。
- `setBitmap` 接受 ImageData 风格 `{ width, height, data }` RGBA 数据。当前黑白转换较简单，
  大图可能产生大缓冲区；先缩放、二值化并用小图测试。
- `V8.Print` 没有任务锁和队列。跨 V8 上下文并发会互相覆盖 `currentTime`、`looptime`、
  `lastData` 等共享状态，必须由业务侧全局串行化。

## 安全边界

- TSC 的 `setText`、`setQR`、`setBarCode` 和 `addCommand` 会拼协议文本。移除引号、换行、
  NUL/控制字符并限制长度；`addCommand` 只接受固定、受审查的命令。
- 蓝牙设备名称、ID 和服务特征均是外部输入。不要拼入 `innerHTML`，展示时做文本转义；不要
  记录或上传完整 `BLEInformation`，以免泄露终端指纹。
- 金额、数量、坐标、纸张尺寸、包长和份数先做类型/范围校验，避免无限循环或超大缓冲区。
- 打印内容含个人信息、票据或密钥时，不写控制台、系统日志或异常上报正文。
- 浏览器权限拒绝、用户取消、GATT 断开、找不到服务/特征和写包失败都必须可理解地提示。

## 实机验收

至少记录：

1. 打印机品牌、型号、固件、纸张规格、服务/写特征 UUID 和指令集。
2. 5+App 或浏览器版本；首次授权、再次连接、主动断开、页面刷新和断线重连。
3. 中文、数字、特殊字符、二维码、条码、长文本、图片和边界金额。
4. 默认 20 字节与目标包长；同时覆盖“长度恰好整除包长”。
5. 连续 20 张严格串行发送，无乱序、丢包、重复或任务状态互相污染。
6. 中途关机、缺纸、离开范围、权限撤销后的失败位置与恢复行为。
7. 页面只确认“数据已发送”；若业务要求确认物理结果，另接状态回读或人工确认。
