# Date Related Processing

> * in [system settings]-> [development configuration]-> [global front-end V8 engine, global server-side V8 engine] add [DateFormat, DateAdd, DateNow] related functions
```js
function DateNow(format) {
  var time = new Date();
  if (!format) {
    var year = time.getFullYear();
    var month = time.getMonth() + 1;
    var day = time.getDate();
    var hh = time.getHours();
    var mm = time.getMinutes();
    var ss = time.getSeconds();
    return year + '-' 
            + (month > 9 ? month : '0' + month) + '-' 
            + (day > 9 ? day : '0' + day) + ' ' 
            + (hh > 9 ? hh : '0' + hh) + ':' 
            + (mm > 9 ? mm : '0' + mm) + ':' 
            + (ss > 9 ? ss : '0' + ss);
  }
  
  var year = time.getFullYear();
  var month = ('0' + (time.getMonth() + 1)).slice(-2);
  var day = ('0' + time.getDate()).slice(-2);
  var hours = ('0' + time.getHours()).slice(-2);
  var minutes = ('0' + time.getMinutes()).slice(-2);
  var seconds = ('0' + time.getSeconds()).slice(-2);

  var formattedDate = format;

  formattedDate = formattedDate.replace('yyyy', year);
  formattedDate = formattedDate.replace('MM', month);
  formattedDate = formattedDate.replace('dd', day);
  formattedDate = formattedDate.replace('HH', hours);
  formattedDate = formattedDate.replace('mm', minutes);
  formattedDate = formattedDate.replace('ss', seconds);

  return formattedDate;
}
//传入日期或字符串类型的time
function DateFormat(time, format) {
  if (!time) {
    return null;
  }
  if (typeof time === 'string') {
    time = new Date(time);
  }
  if (!format) {
    format = 'yyyy-MM-dd HH:mm:ss';
  }

  var year = time.getFullYear();
  var month = ('0' + (time.getMonth() + 1)).slice(-2);
  var day = ('0' + time.getDate()).slice(-2);
  var hours = ('0' + time.getHours()).slice(-2);
  var minutes = ('0' + time.getMinutes()).slice(-2);
  var seconds = ('0' + time.getSeconds()).slice(-2);

  format = format.replace('yyyy', year);
  format = format.replace('MM', month);
  format = format.replace('dd', day);
  format = format.replace('HH', hours);
  format = format.replace('mm', minutes);
  format = format.replace('ss', seconds);

  return format;
}
function DateAdd(startTime, strInterval, number, format) {
  var dtTmp = new Date(startTime);
  var realFormat = format || 'yyyy-MM-dd HH:mm:ss';

  if (typeof number === 'string') {
      number = parseInt(number, 10);
  }

  var result = new Date(dtTmp);
  switch (strInterval) {
      case 's': //秒
          result.setSeconds(result.getSeconds() + number);
          break;
      case 'n': //分（这里'n'和'm'重复了，我保留'n'作为分钟，但通常使用'm'）
      case 'm': //分
          result.setMinutes(result.getMinutes() + number);
          break;
      case 'h': //小时
      case 'H': //小时（'H'通常用于24小时制，但这里我们不做区分）
          result.setHours(result.getHours() + number);
          break;
      case 'd': //天
          result.setDate(result.getDate() + number);
          break;
      case 'w': //周
          result.setDate(result.getDate() + number * 7);
          break;
      case 'q': //季
          result.setMonth(result.getMonth() + number * 3);
          break;
      case 'M': //月
          var month = result.getMonth() + number;
          var year = result.getFullYear();
          var day = result.getDate();
          result.setMonth(month);
          // 如果日期溢出，则设置为该月的最后一天
          if (result.getDate() !== day) {
              result.setDate(0); // 设置为上个月的最后一天，然后加1天得到本月的最后一天
          }
          // 如果年份变了（比如从12月增加到下一年1月前的情况），则调整年份
          if (result.getMonth() === month - number && result.getMonth() !== 11) {
              result.setFullYear(year + 1);
          }
          break;
      case 'y': //年
          result.setFullYear(result.getFullYear() + number);
          break;
  }

  // 处理闰年2月29日增加月份或天数后变为3月1日或类似情况
  if (dtTmp.getMonth() === 1 && dtTmp.getDate() === 29 && (result.getMonth() !== 1 || result.getDate() !== 29)) {
      // 如果原日期是2月29日，且结果不是2月29日，则调整为2月的最后一天（平年是28天）
      result.setDate(28);
  }

  return DateFormat(result, realFormat);
}
```

## Date Formatting
```js
var result = DateFormat(new Date(), 'yyyy-MM-dd HH:mm:ss');
```

## Date addition and subtraction
```js
var result = DateAdd(new Date(), 'd', 1, 'yyyy-MM-dd HH:mm:ss');//增加1天，返回'yyyy-MM-dd HH:mm:ss'
var result = DateAdd(new Date(), 'd', -1, 'yyyy-MM-dd');//减少1天，返回'yyyy-MM-dd'
var result = DateAdd(new Date(), 'M', 1, 'yyyy-MM-dd');//增加1个月，返回'yyyy-MM-dd'
```

## _Where Conditional Date Compare Size
```js
//如果日期字段是yyyy-MM-dd HH:mm:ss格式
var result = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['CreateTime', '>', DateFormat(new Date(), 'yyyy-MM-dd HH:mm:ss')]
    ]
})
//如果日期字段是yyyy-MM-dd格式
var result = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [
        ['JiaoyiDate', '>', DateFormat(item.日期字段, 'yyyy-MM-dd')]
    ]
})
```
