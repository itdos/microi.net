
// 下载excel功能
//import XLSX from 'xlsx'
import * as XLSX from 'xlsx';
/**
 * @param dataList 表格数据内容  array
 * @param fileName 文件标题。必须以 .xlsx结尾
 */
export const downloadXlsx = (dataList, fileName) => {
  const stringToBuff = str => {
    let buf = new ArrayBuffer(str.length)
    let view = new Uint8Array(buf)
    for (let i = 0; i !== str.length; ++i) {
      view[i] = str.charCodeAt(i) & 0xff
    }
    return buf
  };
  // 创建表格
  let workbook = XLSX.utils.book_new();
  let worksheet = XLSX.utils.aoa_to_sheet(dataList);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'sheet1');

  // 创建二进制对象写入转换好的字节流
  let xlsxBlob = new Blob(
    [
      stringToBuff(
        XLSX.write(workbook, {
          bookType: 'xlsx',
          bookSST: false,
          type: 'binary'
        })
      )
    ],
    { type: '' }
  );

  const a = document.createElement('a');
  // 利用URL.createObjectURL()方法为a元素生成blob URL
  a.href = URL.createObjectURL(xlsxBlob);// 创建对象超链接
  a.download = fileName
  a.click()
}