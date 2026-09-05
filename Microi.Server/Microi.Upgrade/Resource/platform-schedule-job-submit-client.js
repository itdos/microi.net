/*
 * V8 Event
 * TableKey: diy_schedule_job
 * EventType: SubmitFormV8
 * Version: v1.0.2
 * Function:
 * - 校验任务Key、接口与执行周期；生成简单Cron并兼容历史仅保存Cron的任务。
 */

if (V8.LoadMode === 'Design') return;
if(V8.FormSubmitAction == 'Insert'){
  if(!V8.Form.JobType || !V8.Form.JobName){
    V8.Tips("任务类别、任务key不能为空", false);
    V8.Result = false;
    return;
  }
  if(V8.Form.JobType == "1"){
    if(!V8.Form.ApiEngineKey){
      V8.Tips("ApiEngineKey不能为空", false);
      V8.Result = false;
      return;
    }
  }
  else {
    if(!V8.Form.DllName || !V8.Form.JobPath){
      V8.Tips("Dll名称、任务路径不能为空", false);
      V8.Result = false;
      return;
    }
    if(V8.Form.DllName.indexOf(".dll") == -1){
      V8.Tips("Dll名称不对，需要包含.dll", false);
      V8.Result = false;
      return;
    }
  }
  var regStr = /^[A-Za-z][A-Za-z0-9_.-]{0,49}$/;
  if(!regStr.test(V8.Form.JobName)){
    V8.Tips("任务Key须以英文字母开头，可包含英文、数字、点、下划线和短横线，最多50个字符。", false);
    V8.Result = false;
    return;
  }
}
if(V8.FormSubmitAction == 'Insert' || V8.FormSubmitAction == 'Update'){
  // 校验执行周期
  // 历史任务可能只有有效Cron；编辑保存时直接保留表达式，不强迫重选周期类别。
  if(!V8.Form.ZhiXingZQLB && !V8.Form.CronExpression){
    V8.Tips("请选择执行周期类别", false);
    V8.Result = false;
    return;
  }
   var cron = '';
  if(V8.Form.ZhiXingZQLB == '简单模式'){
    // 校验执行周期
  if(!V8.Form.ZhiXingZQ){
    V8.Tips("请选择执行周期", false);
    V8.Result = false;
    return;
  }
  // 依据执行周期生成cron表达式
  if(V8.Form.ZhiXingZQ == "每天"){
    if(!V8.Form.XiaoShi && String(V8.Form.XiaoShi) !== '0'){
      V8.Tips("请输入小时", false);
      V8.Result = false;
      return;
    } 
    if(!V8.Form.FenZhong && String(V8.Form.FenZhong) !== '0'){
      V8.Tips("请输入分钟", false);
      V8.Result = false;
      return;
    } 
    if(V8.Form.FenZhong > 59 || V8.Form.FenZhong < 0){
      V8.Tips("分钟需要在0-59之间", false);
      V8.Result = false;
      return;
    }
    if(V8.Form.XiaoShi > 23 || V8.Form.XiaoShi < 0){
      V8.Tips("小时需要在0-23之间", false);
      V8.Result = false;
      return;
    }
    cron = `0 ${V8.Form.FenZhong} ${V8.Form.XiaoShi} * * ?`;
  }
  else if(V8.Form.ZhiXingZQ == "N天"){
    if(!V8.Form.XiaoShi && String(V8.Form.XiaoShi) !== '0'){
      V8.Tips("请输入小时", false);
      V8.Result = false;
      return;
    } 
    if(!V8.Form.FenZhong && String(V8.Form.FenZhong) !== '0'){
      V8.Tips("请输入分钟", false);
      V8.Result = false;
      return;
    } 
    if(!V8.Form.Tian && String(V8.Form.Tian) !== '0'){
      V8.Tips("请输入日", false);
      V8.Result = false;
      return;
    } 
    if(V8.Form.FenZhong > 59 || V8.Form.FenZhong < 0){
      V8.Tips("分钟需要在0-59之间", false);
      V8.Result = false;
      return;
    }
    if(V8.Form.XiaoShi > 23 || V8.Form.XiaoShi < 0){
      V8.Tips("小时需要在0-23之间", false);
      V8.Result = false;
      return;
    }
    if(V8.Form.Tian <= 0){
      V8.Tips("日需要大于等于1", false);
      V8.Result = false;
      return;
    }
    cron = `0 ${V8.Form.FenZhong} ${V8.Form.XiaoShi} 1/${V8.Form.Tian} * ?`;
  }
  else if(V8.Form.ZhiXingZQ == "每小时"){
    if(!V8.Form.FenZhong && String(V8.Form.FenZhong) !== '0'){
      V8.Tips("请输入分钟", false);
      V8.Result = false;
      return;
    } 
    if(V8.Form.FenZhong > 59 || V8.Form.FenZhong < 0){
      V8.Tips("分钟需要在0-59之间", false);
      V8.Result = false;
      return;
    }
    cron = `0 ${V8.Form.FenZhong} * * * ?`;
  }
  else if(V8.Form.ZhiXingZQ == "N小时"){
    if(!V8.Form.XiaoShi && String(V8.Form.XiaoShi) !== '0'){
      V8.Tips("请输入小时", false);
      V8.Result = false;
      return;
    } 
    if(!V8.Form.FenZhong && String(V8.Form.FenZhong) !== '0'){
      V8.Tips("请输入分钟", false);
      V8.Result = false;
      return;
    } 
    if(V8.Form.FenZhong > 59 || V8.Form.FenZhong < 0){
      V8.Tips("分钟需要在0-59之间", false);
      V8.Result = false;
      return;
    }
    if(V8.Form.XiaoShi > 23 || V8.Form.XiaoShi <= 0){
      V8.Tips("小时需要在1-23之间", false);
      V8.Result = false;
      return;
    }
    cron = `0 ${V8.Form.FenZhong} 0/${V8.Form.XiaoShi} * * ?`;
  }
  else if(V8.Form.ZhiXingZQ == "N分钟"){
    if(!V8.Form.FenZhong && String(V8.Form.FenZhong) !== '0'){
      V8.Tips("请输入分钟", false);
      V8.Result = false;
      return;
    } 
    if(V8.Form.FenZhong > 59 || V8.Form.FenZhong < 0){
      V8.Tips("分钟需要在0-59之间", false);
      V8.Result = false;
      return;
    }
    cron = `0 0/${V8.Form.FenZhong} * * * ?`;
  }
  else if(V8.Form.ZhiXingZQ == "每星期"){
    if(!V8.Form.XiaoShi && String(V8.Form.XiaoShi) !== '0'){
      V8.Tips("请输入小时", false);
      V8.Result = false;
      return;
    } 
    if(!V8.Form.FenZhong && String(V8.Form.FenZhong) !== '0'){
      V8.Tips("请输入分钟", false);
      V8.Result = false;
      return;
    } 
    if(!V8.Form.Week && String(V8.Form.Week) !== '0'){
      V8.Tips("请输入星期", false);
      V8.Result = false;
      return;
    } 
    if(V8.Form.FenZhong > 59 || V8.Form.FenZhong < 0){
      V8.Tips("分钟需要在0-59之间", false);
      V8.Result = false;
      return;
    }
    if(V8.Form.XiaoShi > 23 || V8.Form.XiaoShi < 0){
      V8.Tips("小时需要在0-23之间", false);
      V8.Result = false;
      return;
    }
    cron = `0 ${V8.Form.FenZhong} ${V8.Form.XiaoShi} ? * ${V8.Form.Week}`;
  }
  else if(V8.Form.ZhiXingZQ == "每月"){
    if(!V8.Form.XiaoShi && String(V8.Form.XiaoShi) !== '0'){
      V8.Tips("请输入小时", false);
      V8.Result = false;
      return;
    } 
    if(!V8.Form.FenZhong && String(V8.Form.FenZhong) !== '0'){
      V8.Tips("请输入分钟", false);
      V8.Result = false;
      return;
    } 
    if(!V8.Form.Tian && String(V8.Form.Tian) !== '0'){
      V8.Tips("请输入日", false);
      V8.Result = false;
      return;
    } 
    if(V8.Form.FenZhong > 59 || V8.Form.FenZhong < 0){
      V8.Tips("分钟需要在0-59之间", false);
      V8.Result = false;
      return;
    }
    if(V8.Form.XiaoShi > 23 || V8.Form.XiaoShi < 0){
      V8.Tips("小时需要在0-23之间", false);
      V8.Result = false;
      return;
    }
    if(V8.Form.Tian > 30 || V8.Form.Tian < 1){
      V8.Tips("日需要在1-30之间", false);
      V8.Result = false;
      return;
    }
    cron = `0 ${V8.Form.FenZhong} ${V8.Form.XiaoShi} ${V8.Form.Tian} * ?`;
  }
  else if(V8.Form.ZhiXingZQ == "N秒"){
    if(!V8.Form.Miao && String(V8.Form.Miao) !== '0'){
      V8.Tips("请输入秒", false);
      V8.Result = false;
      return;
    } 
    if(V8.Form.Miao > 59 || V8.Form.Miao <= 0){
      V8.Tips("秒需要在1-59之间", false);
      V8.Result = false;
      return;
    }
    cron = `0/${V8.Form.Miao} * * * * ?`;
  }
  V8.FormSet('CronExpression', cron);
  }
  else{
    cron = V8.Form.CronExpression;
  }
  
  if(!cron){
    V8.Tips("请选择执行周期", false);
    V8.Result = false;
    return;
  }
}
if(V8.FormSubmitAction == 'Insert'){
  V8.FormSet('Status','创建中');
}
