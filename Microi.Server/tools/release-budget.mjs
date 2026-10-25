import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const execute=promisify(execFile),windows=process.platform==='win32';
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const epoch=()=>Date.now()/1000;
const validEpoch=value=>Number.isFinite(value)&&value>0;
const ps=script=>execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,maxBuffer:4096});

// Windows 的 PID 可以复用；只记录本次 spawn 的启动时间，不枚举或输出命令行/环境。
async function startedTicks(pid){
 const {stdout}=await ps(`$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue;if($p){$p.StartTime.ToUniversalTime().Ticks.ToString()}`);
 return /^\d+$/.test(stdout.trim())?stdout.trim():null;
}
async function stopWindowsTree(pid,ticks){
 if(!ticks)throw Error('Owned process identity unavailable');
 await ps(`$ErrorActionPreference='Stop';$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue;if(!$p){exit 0};if($p.StartTime.ToUniversalTime().Ticks.ToString() -ne '${ticks}'){exit 3};
 $owned=@(@{Id=${pid};Start='${ticks}'});$rows=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId);for($i=0;$i -lt $owned.Count;$i++){foreach($row in $rows){if($row.ParentProcessId -eq $owned[$i].Id -and $row.ProcessId -notin $owned.Id){$child=Get-Process -Id $row.ProcessId -ErrorAction SilentlyContinue;if($child){$owned+=@{Id=[int]$row.ProcessId;Start=$child.StartTime.ToUniversalTime().Ticks.ToString()}}}}};
 $p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue;if(!$p){exit 4};if($p.StartTime.ToUniversalTime().Ticks.ToString() -ne '${ticks}'){exit 3};
 & taskkill.exe /PID ${pid} /T /F 2>&1 | Out-Null;
 $end=[DateTime]::UtcNow.AddSeconds(5);do{$live=@($owned | Where-Object {$q=Get-Process -Id $_.Id -ErrorAction SilentlyContinue;$q -and $q.StartTime.ToUniversalTime().Ticks.ToString() -eq $_.Start});if(!$live.Count){exit 0};Start-Sleep -Milliseconds 100}while([DateTime]::UtcNow -lt $end);exit 4`);
}
async function stopPosixGroup(pid){
 const signal=name=>{try{process.kill(-pid,name);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
 if(!signal('SIGTERM'))return;
 await delay(250);signal('SIGKILL');
 for(let attempt=0;attempt<50;attempt++){if(!signal(0))return;await delay(100);}
 throw Error('Owned process group did not exit');
}

// 显式单操作硬超时保留原行为；普通平台发布只调用下方 runReleaseTarget，不因总耗时杀进程。
export function runReleaseBudget(deadline,command,args=[]){
 if(!validEpoch(deadline)||!command)throw Error('Invalid release deadline or command');
 const remaining=deadline*1000-Date.now();
 if(remaining<=0)return Promise.resolve(124);
 return new Promise(resolve=>{
  let child,finished=false,expired=false,timer,identity;
  const finish=code=>{if(finished)return;finished=true;clearTimeout(timer);resolve(code);};
  // Windows 独立 Node 子树隔离控制台；不能直接 detached 启动 pwsh，否则可能退出 0 却未执行命令。
  try{child=spawn(windows?process.execPath:command,windows?[fileURLToPath(import.meta.url),'windows-child',command,...args]:args,{stdio:'inherit',windowsHide:true,detached:true});}catch{finish(127);return;}
  child.once('error',()=>finish(127));
  child.once('close',code=>{if(!expired)finish(epoch()>deadline?124:(code??1));});
  // 创建事件之后立即捕获身份，快速命令已退出时无需终止任何进程。
  child.once('spawn',()=>{if(windows)identity=startedTicks(child.pid).catch(()=>null);});
  timer=setTimeout(async()=>{
   if(finished)return;expired=true;
   try{if(windows)await stopWindowsTree(child.pid,await identity);else await stopPosixGroup(child.pid);finish(124);}
   catch{process.stderr.write('Release budget expired; owned process-tree cleanup could not be confirmed.\n');finish(125);}
  },Math.min(remaining,2147483647));
 });
}

// 30 分钟是整个发布的耗时目标。到点只告警，不给正在执行或后续命令制造 124。
// 不创建 detached 子树，使普通取消继续沿宿主进程组传播；命令自身超时/失败仍原样返回。
export function runReleaseTarget(target,command,args=[]){
 if(!validEpoch(target)||!command)throw Error('Invalid release target or command');
 return new Promise(resolve=>{
  let child,finished=false,timer;
  const finish=code=>{if(finished)return;finished=true;clearTimeout(timer);resolve(code);};
  const warn=()=>process.stderr.write('PlatformRelease exceeded the 30-minute elapsed-time target; continuing release and recording the overrun.\n');
  const remaining=target*1000-Date.now();
  if(remaining<=0)warn();else timer=setTimeout(warn,Math.min(remaining,2147483647));
  try{child=spawn(command,args,{stdio:'inherit',windowsHide:true});}catch{finish(127);return;}
  child.once('error',()=>finish(127));
  child.once('close',(code,signal)=>finish(code??(signal==='SIGINT'?130:signal==='SIGTERM'?143:1)));
 });
}

// 小型 JSONL 时序回执沿用同一次开始/目标时间；发布成功与耗时达标分别记录。
export function recordReleasePhase(file,started,phase,exitCode,finished=epoch()){
 if(!path.isAbsolute(file)||!validEpoch(started)||!validEpoch(finished)||finished<started||!Number.isInteger(exitCode)||exitCode<0||exitCode>255||typeof phase!=='string'||!phase.length||phase.length>160||/[\r\n\u0000-\u001f]/.test(phase))throw Error('Invalid release phase record');
 let previous=null;
 if(fs.existsSync(file)){
  const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Release budget record must be a regular file');
  const rows=fs.readFileSync(file,'utf8').trim().split('\n');previous=JSON.parse(rows.at(-1));
  if(previous.scope!=='PlatformRelease'||previous.startedEpochSeconds!==started||previous.deadlineEpochSeconds!==started+1800||previous.finishedEpochSeconds>finished)throw Error('Release budget record belongs to another run');
 }
 const phaseStarted=previous?.finishedEpochSeconds??started;
 // deadlineEpochSeconds 保留兼容旧读者；新字段明确这是告警目标而不是强制终止时间。
 const record={schemaVersion:1,scope:'PlatformRelease',budgetPolicy:'advisory',startedEpochSeconds:started,deadlineEpochSeconds:started+1800,targetEpochSeconds:started+1800,phase,phaseStartedEpochSeconds:phaseStarted,finishedEpochSeconds:finished,elapsedSeconds:finished-phaseStarted,totalElapsedSeconds:finished-started,exitCode,withinBudget:finished<=started+1800,targetExceeded:finished>started+1800};
 fs.appendFileSync(file,JSON.stringify(record)+'\n');return record;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [mode,...args]=process.argv.slice(2);
 try{
  if(mode==='windows-child'&&windows&&args[0]){
   // 真实命令继承独立子树的标准流，保留原退出码；外层仍按该 Node 的 PID/启动时间清理整树。
   process.exitCode=await new Promise(resolve=>{
    const child=spawn(args[0],args.slice(1),{stdio:'inherit',windowsHide:true});
    child.once('error',()=>resolve(127));child.once('close',code=>resolve(code??1));
   });
  }
  else if(mode==='run')process.exitCode=await runReleaseBudget(Number(args[0]),args[1],args.slice(2));
  else if(mode==='run-target')process.exitCode=await runReleaseTarget(Number(args[0]),args[1],args.slice(2));
  else if(mode==='record'){recordReleasePhase(args[0],Number(args[1]),args[2],Number(args[3]));process.exitCode=0;}
  else throw Error('Usage');
 }catch{process.stderr.write('Usage: release-budget.mjs run-target <targetEpochSeconds> <command> [...args] | run <deadlineEpochSeconds> <command> [...args] | record <absolute-jsonl> <startedEpochSeconds> <phase> <exitCode>\n');process.exitCode=2;}
}
