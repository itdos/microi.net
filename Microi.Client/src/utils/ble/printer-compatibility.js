/**
 * 蓝牙打印机型号与指令兼容层。
 *
 * 佳博 GP-M322 继续原样发送 TSPL；ZICOX CC4 将 createNew() 产生的
 * TSC 操作转换成厂家 SDK 使用的 CPCL。createNewESC() 始终原样发送。
 */
import { encode } from "./encoding.js";

const PRINT_PROTOCOL_PROPERTY = "__microiPrintProtocol";
const PRINT_OPERATIONS_PROPERTY = "__microiPrintOperations";
const DOTS_PER_MM = 8;

const PRINTER_PROFILES = Object.freeze({
    "generic-tspl": Object.freeze({
        id: "generic-tspl",
        name: "通用 TSPL 蓝牙打印机",
        commandLanguage: "tspl",
        preferredTransport: "ble",
    }),
    "gprinter-gp-m322": Object.freeze({
        id: "gprinter-gp-m322",
        name: "佳博 GP-M322",
        commandLanguage: "tspl",
        preferredTransport: "ble",
    }),
    "zicox-cc4": Object.freeze({
        id: "zicox-cc4",
        name: "ZICOX CC4",
        commandLanguage: "cpcl",
        preferredTransport: "ble",
        fallbackTransport: "spp",
        pageWidthDots: 832,
        pageHeightDots: 400,
    }),
});

function normalizeProfileMode(profileMode) {
    var value = String(profileMode || "auto").toLowerCase();
    return value === "auto" || PRINTER_PROFILES[value] ? value : "auto";
}

function resolvePrinterProfile(deviceName, profileMode) {
    var mode = normalizeProfileMode(profileMode);
    if (mode !== "auto") return PRINTER_PROFILES[mode];
    var name = String(deviceName || "");
    if (/\bzicox\b|\bcc[-_\s]?4\b/i.test(name)) return PRINTER_PROFILES["zicox-cc4"];
    if (/\bgprinter\b|佳博|\bgp[-_\s]?m322\b/i.test(name)) return PRINTER_PROFILES["gprinter-gp-m322"];
    return PRINTER_PROFILES["generic-tspl"];
}

function getPrinterProfile(profileId) {
    return PRINTER_PROFILES[String(profileId || "").toLowerCase()] || PRINTER_PROFILES["generic-tspl"];
}

function tagPrintData(data, protocol, operations) {
    if (!data || (typeof data !== "object" && typeof data !== "function")) return data;
    try {
        Object.defineProperty(data, PRINT_PROTOCOL_PROPERTY, {
            configurable: true,
            enumerable: false,
            value: String(protocol || "raw").toLowerCase(),
        });
        if (operations) {
            Object.defineProperty(data, PRINT_OPERATIONS_PROPERTY, {
                configurable: true,
                enumerable: false,
                value: operations,
            });
        }
    } catch (error) {
        // 旧浏览器或冻结对象不支持元数据时仍返回原始字节，不影响佳博路径。
    }
    return data;
}

function getPayloadProtocol(data) {
    if (!data) return "raw";
    var tagged = String(data[PRINT_PROTOCOL_PROPERTY] || "").toLowerCase();
    if (tagged) return tagged;
    var prefix = "";
    var length = Math.min(Number(data.length) || 0, 48);
    for (var i = 0; i < length; i++) {
        var value = Number(data[i]) & 0xff;
        prefix += value >= 32 && value <= 126 ? String.fromCharCode(value) : " ";
    }
    if (/^\s*!\s+\d+\s+\d+\s+\d+/i.test(prefix)) return "cpcl";
    if (/^\s*(SIZE|SPEED|DENSITY|GAP|BLINE|CLS|DIRECTION|REFERENCE|TEXT|QRCODE|BARCODE|BITMAP|PRINT)\b/i.test(prefix)) return "tspl";
    if ((Number(data[0]) & 0xff) === 27 || (Number(data[0]) & 0xff) === 29) return "escpos";
    return "raw";
}

function toFiniteNumber(value, label) {
    var number = Number(value);
    if (!Number.isFinite(number)) throw new Error(label + " 必须是有效数字");
    return number;
}

function toInteger(value, label, min, max) {
    var number = Math.round(toFiniteNumber(value, label));
    if (typeof min === "number" && number < min) throw new Error(label + " 不能小于 " + min);
    if (typeof max === "number" && number > max) throw new Error(label + " 不能大于 " + max);
    return number;
}

function clampInteger(value, fallback, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanInlineText(value, maxLength) {
    return String(value == null ? "" : value)
        .replace(/[\r\n\x00-\x1f]/g, " ")
        .slice(0, maxLength || 2048);
}

function createByteWriter() {
    var bytes = [];
    var encoder = new encode.TextEncoder("gb18030", { NONSTANDARD_allowLegacyEncoding: true });
    return {
        bytes: bytes,
        text: function (value) {
            var encoded = encoder.encode(String(value));
            for (var i = 0; i < encoded.length; i++) bytes.push(encoded[i]);
        },
        raw: function (value, start, length) {
            var begin = Math.max(0, Number(start) || 0);
            var end = typeof length === "number" ? Math.min(value.length, begin + length) : value.length;
            for (var i = begin; i < end; i++) bytes.push(Number(value[i]) & 0xff);
        },
    };
}

function cpclFontFromTsc(fontName) {
    var font = String(fontName || "").toUpperCase();
    if (font.includes("16")) return 55;
    if (font.includes("32")) return 56;
    return 24;
}

function cpclBarcodeType(type) {
    var value = String(type || "128").replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
    var aliases = { CODE128: "128", CODE39: "39", CODABAR: "CODABAR", EAN13: "EAN13", EAN8: "EAN8" };
    return aliases[value] || value || "128";
}

function convertTscOperationsToCpcl(data, operations, profile) {
    if (!Array.isArray(operations) || operations.length === 0) {
        throw new Error("CC4 无法识别这份 TSPL 数据；请直接传入 createNew().getData()，不要复制或序列化字节数组");
    }

    var state = {
        width: profile.pageWidthDots || 832,
        height: profile.pageHeightDots || 400,
        sensor: "",
        rotation: "ZPROTATE",
        referenceX: 0,
        referenceY: 0,
        pagePrintCount: 0,
        body: createByteWriter(),
    };

    function x(value) { return toInteger(value, "X 坐标", -32768, 32767) + state.referenceX; }
    function y(value) { return toInteger(value, "Y 坐标", -32768, 32767) + state.referenceY; }
    function line(value) { state.body.text(value + "\r\n"); }

    for (var index = 0; index < operations.length; index++) {
        var operation = operations[index] || {};
        var name = String(operation.name || "");
        var args = Array.isArray(operation.args) ? operation.args : [];
        switch (name) {
            case "init":
            case "setCls":
                break;
            case "setSize":
                state.width = toInteger(toFiniteNumber(args[0], "标签宽度") * DOTS_PER_MM, "标签宽度点数", 1, 4096);
                state.height = toInteger(toFiniteNumber(args[1], "标签高度") * DOTS_PER_MM, "标签高度点数", 1, 32767);
                break;
            case "setSpeed":
                line("SPEED " + clampInteger(args[0], 3, 0, 5));
                break;
            case "setDensity":
                line("CONTRAST " + clampInteger(args[0], 0, 0, 15));
                break;
            case "setGap":
                state.sensor = "GAP-SENSE";
                break;
            case "setBline":
                state.sensor = "BAR-SENSE";
                break;
            case "setFeed":
                line("POSTFEED " + toInteger(args[0], "前进走纸", 0, 32767));
                break;
            case "setBackFeed":
                line("PREFEED " + toInteger(args[0], "回拉走纸", 0, 32767));
                break;
            case "setDirection":
                if (Number(args[0]) === 1) state.rotation = "ZPROTATE180";
                else if (Number(args[0]) === 0) state.rotation = "ZPROTATE";
                else throw new Error("CC4 兼容层仅支持 DIRECTION 0 或 1");
                break;
            case "setReference":
                state.referenceX = toInteger(args[0], "参考点 X", -32768, 32767);
                state.referenceY = toInteger(args[1], "参考点 Y", -32768, 32767);
                break;
            case "setBar": {
                var barX = x(args[0]);
                var barY = y(args[1]);
                var barWidth = toInteger(args[2], "线条宽度", 1, 32767);
                var barHeight = toInteger(args[3], "线条高度", 1, 32767);
                line("LINE " + barX + " " + barY + " " + (barX + barWidth - 1) + " " + barY + " " + barHeight);
                break;
            }
            case "setBox":
                line("BOX " + x(args[0]) + " " + y(args[1]) + " " + x(args[2]) + " " + y(args[3]) + " " + toInteger(args[4], "边框宽度", 1, 255));
                break;
            case "setReverse": {
                var reverseX = x(args[0]);
                var reverseY = y(args[1]);
                var reverseWidth = toInteger(args[2], "反相宽度", 1, 32767);
                var reverseHeight = toInteger(args[3], "反相高度", 1, 32767);
                line("INVERSE-LINE " + reverseX + " " + reverseY + " " + (reverseX + reverseWidth - 1) + " " + reverseY + " " + reverseHeight);
                break;
            }
            case "setText": {
                var scaleX = clampInteger(args[3], 1, 1, 10);
                var scaleY = clampInteger(args[4], 1, 1, 10);
                line("SETMAG " + scaleX + " " + scaleY);
                line("T " + cpclFontFromTsc(args[2]) + " 0 " + x(args[0]) + " " + y(args[1]) + " " + cleanInlineText(args[5], 2048));
                line("SETMAG 0 0");
                break;
            }
            case "setQR": {
                var qrLevel = String(args[2] || "L").toUpperCase();
                if (!/^[LMQH]$/.test(qrLevel)) qrLevel = "L";
                var qrSize = clampInteger(args[3], 5, 1, 32);
                line("BARCODE QR " + x(args[0]) + " " + y(args[1]) + " M 2 U " + qrSize);
                line(qrLevel + "A," + cleanInlineText(args[5], 4096));
                line("ENDQR");
                break;
            }
            case "setBarCode": {
                var readable = Number(args[4]) !== 0;
                var narrow = clampInteger(args[5], 2, 1, 10);
                var wide = clampInteger(args[6], narrow * 2, narrow, 40);
                var ratio = clampInteger(wide / narrow, 2, 1, 4);
                if (readable) line("BARCODE-TEXT 24 0 5");
                line("BARCODE " + cpclBarcodeType(args[2]) + " " + narrow + " " + ratio + " " + toInteger(args[3], "条码高度", 1, 32767) + " " + x(args[0]) + " " + y(args[1]) + " " + cleanInlineText(args[7], 1024));
                if (readable) line("BARCODE-TEXT OFF");
                break;
            }
            case "setBitmap": {
                var byteWidth = toInteger(operation.byteWidth, "位图字节宽度", 1, 8192);
                var bitmapHeight = toInteger(operation.height, "位图高度", 1, 32767);
                var byteLength = byteWidth * bitmapHeight;
                if (!Number.isInteger(operation.byteOffset) || operation.byteOffset < 0 || operation.byteOffset + byteLength > data.length) {
                    throw new Error("CC4 位图元数据不完整，请重新调用 setBitmap 生成打印数据");
                }
                state.body.text("CG " + byteWidth + " " + bitmapHeight + " " + x(args[0]) + " " + y(args[1]) + " ");
                state.body.raw(data, operation.byteOffset, byteLength);
                state.body.text("\r\n");
                break;
            }
            case "setPagePrint":
                state.pagePrintCount++;
                break;
            case "setErase":
            case "setSound":
            case "setLimitfeed":
            case "setCountry":
            case "setCodepage":
            case "setFromfeed":
            case "setHome":
            case "addCommand":
                throw new Error("ZICOX CC4 暂不支持自动转换 TSC 方法 " + name + "；为避免打印乱码，本次未发送任何数据");
            default:
                throw new Error("ZICOX CC4 遇到未知 TSC 方法 " + (name || "(空)") + "；为避免打印乱码，本次未发送任何数据");
        }
    }

    if (state.pagePrintCount !== 1) {
        throw new Error("ZICOX CC4 每份标签必须且只能调用一次 setPagePrint()");
    }

    var output = createByteWriter();
    output.text("! 0 200 200 " + state.height + " 1\r\n");
    output.text("PAGE-WIDTH " + state.width + "\r\n");
    output.text(state.rotation + "\r\n");
    if (state.sensor) output.text(state.sensor + "\r\n");
    output.raw(state.body.bytes);
    output.text("FORM\r\nPRINT\r\n");
    return tagPrintData(output.bytes, "cpcl");
}

function adaptPrintPayload(data, profileOrId) {
    var profile = typeof profileOrId === "string" ? getPrinterProfile(profileOrId) : (profileOrId || PRINTER_PROFILES["generic-tspl"]);
    if (profile.commandLanguage !== "cpcl") return data;
    var protocol = getPayloadProtocol(data);
    if (protocol === "escpos" || protocol === "cpcl" || protocol === "raw") return data;
    if (protocol !== "tspl") return data;
    return convertTscOperationsToCpcl(data, data[PRINT_OPERATIONS_PROPERTY], profile);
}

export {
    PRINTER_PROFILES,
    adaptPrintPayload,
    getPayloadProtocol,
    getPrinterProfile,
    normalizeProfileMode,
    resolvePrinterProfile,
    tagPrintData,
};
