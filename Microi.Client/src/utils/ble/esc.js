/**
 * ESC/POS 票据打印机指令构建器
 * 
 * 用于佳博等支持ESC/POS指令集的票据打印机。
 * 从 microi.uniapp.uni-ui/utils/ble/esc.js 移植，适配Web端使用。
 * 
 * 用法示例：
 *   var command = esc.jpPrinter.createNew();
 *   command.init();
 *   command.bold(1);
 *   command.setFontSize(16);
 *   command.setSelectJustification(1);
 *   command.setText("杭州总店");
 *   command.setPrint();
 *   var data = command.getData();
 */
import { encode } from "./encoding.js";

var jpPrinter = {
  createNew: function () {
    var jpPrinter = {};
    var data = [];

    var bar = ["UPC-A", "UPC-E", "EAN13", "EAN8", "CODE39", "ITF", "CODABAR", "CODE93", "CODE128"];

    jpPrinter.name = "蓝牙打印机";

    jpPrinter.init = function () {
      // 初始化打印机
      data.push(27);
      data.push(64);
    };

    jpPrinter.setText = function (content) {
      // 设置文本内容
      var code = new encode.TextEncoder(
        'gb18030', {
          NONSTANDARD_allowLegacyEncoding: true
        }).encode(content);
      for (var i = 0; i < code.length; ++i) {
        data.push(code[i]);
      }
    };

    jpPrinter.setFontSize = function (n) {
      // 设置字体大小
      data.push(29);
      data.push(33);
      data.push(n);
    };

    jpPrinter.bold = function (n) {
      // 加粗
      data.push(27);
      data.push(69);
      data.push(n);
    };

    jpPrinter.setUnderline = function (n) {
      // 设置下划线
      data.push(27);
      data.push(45);
      data.push(n);
    };

    jpPrinter.setUnderline2 = function (n) {
      // 设置下划线2
      data.push(28);
      data.push(45);
      data.push(n);
    };

    jpPrinter.setSelectSizeOfModuleForQRCode = function (n) {
      // 设置二维码大小
      data.push(29);
      data.push(40);
      data.push(107);
      data.push(3);
      data.push(0);
      data.push(49);
      data.push(67);
      if (n > 15) { n = 15; }
      if (n < 1) { n = 1; }
      data.push(n);
    };

    jpPrinter.setSelectErrorCorrectionLevelForQRCode = function (n) {
      // 设置纠错等级
      data.push(29);
      data.push(40);
      data.push(107);
      data.push(3);
      data.push(0);
      data.push(49);
      data.push(69);
      data.push(n);
    };

    jpPrinter.setStoreQRCodeData = function (content) {
      // 设置二维码内容
      var code = new encode.TextEncoder(
        'gb18030', {
          NONSTANDARD_allowLegacyEncoding: true
        }).encode(content);
      data.push(29);
      data.push(40);
      data.push(107);
      data.push(parseInt((code.length + 3) % 256));
      data.push(parseInt((code.length + 3) / 256));
      data.push(49);
      data.push(80);
      data.push(48);
      for (var i = 0; i < code.length; ++i) {
        data.push(code[i]);
      }
    };

    jpPrinter.setPrintQRCode = function () {
      // 打印二维码
      data.push(29);
      data.push(40);
      data.push(107);
      data.push(3);
      data.push(0);
      data.push(49);
      data.push(81);
      data.push(48);
    };

    jpPrinter.setHorTab = function () {
      // 移动到下一个水平定位点
      data.push(9);
    };

    jpPrinter.setAbsolutePrintPosition = function (where) {
      // 设置绝对打印位置
      data.push(27);
      data.push(36);
      data.push(parseInt(where % 256));
      data.push(parseInt(where / 256));
    };

    jpPrinter.setRelativePrintPositon = function (where) {
      // 设置相对横向打印位置
      data.push(27);
      data.push(92);
      data.push(parseInt(where % 256));
      data.push(parseInt(where / 256));
    };

    jpPrinter.setSelectJustification = function (which) {
      // 对齐方式: 0=左对齐, 1=居中, 2=右对齐
      data.push(27);
      data.push(97);
      data.push(which);
    };

    jpPrinter.space = function (n) {
      // 设置横向跳格位置
      data.push(27);
      data.push(68);
      data.push(n);
    };

    jpPrinter.setLeftMargin = function (n) {
      // 设置左边距
      data.push(29);
      data.push(76);
      data.push(parseInt(n % 256));
      data.push(parseInt(n / 256));
    };

    jpPrinter.textMarginRight = function (n) {
      // 设置字符右间距
      data.push(27);
      data.push(32);
      data.push(n);
    };

    jpPrinter.rowSpace = function (n) {
      // 设置行间距
      data.push(27);
      data.push(51);
      data.push(n);
    };

    jpPrinter.setPrintingAreaWidth = function (width) {
      // 设置打印区域宽度
      data.push(29);
      data.push(87);
      data.push(parseInt(width % 256));
      data.push(parseInt(width / 256));
    };

    jpPrinter.setSound = function (n, t) {
      // 设置蜂鸣器
      if (n < 0) { n = 1; } else if (n > 9) { n = 9; }
      if (t < 0) { t = 1; } else if (t > 9) { t = 9; }
      data.push(27);
      data.push(66);
      data.push(n);
      data.push(t);
    };

    jpPrinter.setBitmap = function (res) {
      // 参数：画布参数
      var width = parseInt((res.width + 7) / 8 * 8 / 8);
      var height = res.height;
      var time = 1;
      var temp = res.data.length - width * 32;
      var point_list = [];
      data.push(29);
      data.push(118);
      data.push(48);
      data.push(0);
      data.push((parseInt((res.width + 7) / 8) * 8) / 8);
      data.push(0);
      data.push(parseInt(res.height % 256));
      data.push(parseInt(res.height / 256));
      for (var i = 0; i < height; ++i) {
        for (var j = 0; j < width; ++j) {
          for (var k = 0; k < 32; k += 4) {
            var po = {};
            if (res.data[temp] == 0 && res.data[temp + 1] == 0 && res.data[temp + 2] == 0 && res.data[temp + 3] == 0) {
              po.point = 0;
            } else {
              po.point = 1;
            }
            point_list.push(po);
            temp += 4;
          }
        }
        time++;
        temp = res.data.length - width * 32 * time;
      }
      for (var i = 0; i < point_list.length; i += 8) {
        var p = point_list[i].point * 128 + point_list[i + 1].point * 64 + point_list[i + 2].point * 32 + point_list[i + 3].point * 16 + point_list[i + 4].point * 8 + point_list[i + 5].point * 4 + point_list[i + 6].point * 2 + point_list[i + 7].point;
        data.push(p);
      }
    };

    jpPrinter.setPrint = function () {
      // 打印并换行
      data.push(10);
    };

    jpPrinter.setPrintAndFeed = function (feed) {
      // 打印并走纸feed个单位
      data.push(27);
      data.push(74);
      data.push(feed);
    };

    jpPrinter.setPrintAndFeedRow = function (row) {
      // 打印并走纸row行
      data.push(27);
      data.push(100);
      data.push(row);
    };

    jpPrinter.getData = function () {
      // 获取打印数据
      return data;
    };

    return jpPrinter;
  }
};

var esc = {
  jpPrinter: jpPrinter
};
export { esc };
