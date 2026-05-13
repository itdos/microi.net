# Microi 新模块端到端冒烟测试
# 启动前提：Microi.net.Api 已运行；环境变量 MICROI_DEV_TEST_KEY=test-2026
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
$base = 'https://localhost:7266'
$devKey = 'test-2026'
$pass = 0; $fail = 0
$results = @()

function Test-Endpoint {
    param([string]$Name, [scriptblock]$Block)
    try {
        $r = & $Block
        if ($r -and $r.Code -eq 1) { $script:pass++; Write-Host "  ✅ $Name" -ForegroundColor Green; return $r }
        $script:fail++; Write-Host "  ❌ $Name → Code=$($r.Code) Msg=$($r.Msg)" -ForegroundColor Red; return $r
    } catch { $script:fail++; Write-Host "  ❌ $Name → 异常: $_" -ForegroundColor Red }
}

# === 1. 登录获取 Token ===
Write-Host "`n=== 登录 ===" -ForegroundColor Cyan
$loginBody = @{ Account='admin'; Pwd='_DEV_BYPASS_'; OsClient='lsg' } | ConvertTo-Json
$loginR = Invoke-WebRequest -Uri "$base/api/SysUser/Login" -Method Post -Body $loginBody `
    -ContentType 'application/json' -Headers @{ 'X-Microi-Dev-Key'=$devKey } -TimeoutSec 10
$jr = $loginR.Content | ConvertFrom-Json
if ($jr.Code -ne 1) { Write-Host "登录失败: $($jr | ConvertTo-Json -Depth 4)"; exit 1 }
$token = $loginR.Headers['Authorization']
if ($token -is [System.Array]) { $token = $token[0] }
Write-Host "✅ Token: $($token.Substring(0,40))..." -ForegroundColor Green
$h = @{ Authorization = $token; OsClient = 'lsg'; 'X-Microi-Dev-Key' = $devKey }

# === 2. 状态机 ===
Write-Host "`n=== 状态机 ===" -ForegroundColor Cyan
$listR = Test-Endpoint "ListStateMachines" { Invoke-RestMethod -Uri "$base/api/V8Engine/ListStateMachines?osClient=lsg" -Method Post -Headers $h -Body '{}' -ContentType 'application/json' -TimeoutSec 10 }

$sm = @{
    Name='测试订单状态机'; Code='test_order_sm'; TableName='mall_order'; StatusField='Status'; InitialState='pending';
    Description='冒烟测试'; Status=1;
    States = '[{"code":"pending","label":"待处理","color":"#909399"},{"code":"paid","label":"已支付","color":"#67C23A"},{"code":"shipped","label":"已发货","color":"#409EFF"},{"code":"completed","label":"已完成","color":"#67C23A"}]';
    Transitions = @(
        @{ Name='支付'; FromState='pending'; ToState='paid'; Sort=0 },
        @{ Name='发货'; FromState='paid'; ToState='shipped'; Sort=1 },
        @{ Name='完成'; FromState='shipped'; ToState='completed'; Sort=2 }
    )
} | ConvertTo-Json -Depth 6
$saveR = Test-Endpoint "SaveStateMachine (新建)" { Invoke-RestMethod -Uri "$base/api/V8Engine/SaveStateMachine?osClient=lsg" -Method Post -Headers $h -Body $sm -ContentType 'application/json' -TimeoutSec 10 }
$smId = $saveR.Data.Id
Write-Host "    新建 SM Id=$smId"

$getR = Test-Endpoint "GetStateMachine" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetStateMachine?osClient=lsg" -Method Post -Headers $h -Body (@{Id=$smId}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 }
if ($getR.Data.Transitions.Count -eq 3) { Write-Host "    ✅ 已保存 3 个 Transition" -ForegroundColor Green } else { Write-Host "    ❌ Transition 数量=$($getR.Data.Transitions.Count)" -ForegroundColor Red; $fail++ }

Test-Endpoint "GetStateHistory (空)" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetStateHistory?osClient=lsg" -Method Post -Headers $h -Body (@{TableName='mall_order';RowId='not-exist'}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 } | Out-Null

Test-Endpoint "DeleteStateMachine" { Invoke-RestMethod -Uri "$base/api/V8Engine/DeleteStateMachine?osClient=lsg" -Method Post -Headers $h -Body (@{Id=$smId}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 } | Out-Null

# === 3. 流程引擎 ===
Write-Host "`n=== 流程引擎 ===" -ForegroundColor Cyan
Test-Endpoint "ListFlows" { Invoke-RestMethod -Uri "$base/api/V8Engine/ListFlows?osClient=lsg" -Method Post -Headers $h -Body '{}' -ContentType 'application/json' -TimeoutSec 10 } | Out-Null

$flowData = @{
    nodes = @(
        @{ id='n1'; type='start'; label='开始'; config=@{}; nextNodeIds=@('n2') },
        @{ id='n2'; type='set'; label='设置变量'; config=@{ vars=@{ x=10 } }; nextNodeIds=@('n3') },
        @{ id='n3'; type='if'; label='判断'; config=@{ condition='input.x > 5'; trueNext='n4'; falseNext='n5' }; nextNodeIds=@() },
        @{ id='n4'; type='log'; label='大于'; config=@{ message='x>5' }; nextNodeIds=@('n6') },
        @{ id='n5'; type='log'; label='小于等于'; config=@{ message='x<=5' }; nextNodeIds=@('n6') },
        @{ id='n6'; type='end'; label='结束'; config=@{}; nextNodeIds=@() }
    )
}
$flow = @{
    Name='测试流程'; Code='test_flow'; TriggerType='manual';
    Description='冒烟测试 DAG'; Status=1; MaxRetry=0; Timeout=30;
    FlowData = ($flowData | ConvertTo-Json -Depth 8 -Compress)
} | ConvertTo-Json -Depth 8
$saveFlow = Test-Endpoint "SaveFlow (新建)" { Invoke-RestMethod -Uri "$base/api/V8Engine/SaveFlow?osClient=lsg" -Method Post -Headers $h -Body $flow -ContentType 'application/json' -TimeoutSec 10 }
$flowId = $saveFlow.Data.Id
Write-Host "    新建 Flow Id=$flowId"

Test-Endpoint "GetFlow" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetFlow?osClient=lsg" -Method Post -Headers $h -Body (@{Id=$flowId}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 } | Out-Null

$runR = Test-Endpoint "RunFlow" { Invoke-RestMethod -Uri "$base/api/V8Engine/RunFlow?osClient=lsg" -Method Post -Headers $h -Body (@{Id=$flowId; Input=@{x=10}}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 15 }
Write-Host "    执行状态: $($runR.Data.Status), 耗时 $($runR.Data.DurationMs)ms"

Test-Endpoint "GetFlowRuns" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetFlowRuns?osClient=lsg" -Method Post -Headers $h -Body (@{FlowId=$flowId}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 } | Out-Null

if ($runR.Data.Id) {
    Test-Endpoint "GetFlowRunDetail" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetFlowRunDetail?osClient=lsg" -Method Post -Headers $h -Body (@{RunId=$runR.Data.Id}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 } | Out-Null
}

Test-Endpoint "DeleteFlow" { Invoke-RestMethod -Uri "$base/api/V8Engine/DeleteFlow?osClient=lsg" -Method Post -Headers $h -Body (@{Id=$flowId}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 } | Out-Null

# === 4. 过程挖掘 ===
Write-Host "`n=== 过程挖掘 ===" -ForegroundColor Cyan
# 任取一个工作流设计 Id（如无则可用占位 Id，确认不崩溃即可）
$body = @{ FlowDesignId='non-existent-id'; StartTime=''; EndTime='' } | ConvertTo-Json
Test-Endpoint "GetWorkflowOverview" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetWorkflowOverview?osClient=lsg" -Method Post -Headers $h -Body $body -ContentType 'application/json' -TimeoutSec 10 } | Out-Null
Test-Endpoint "AnalyzeWorkflow" { Invoke-RestMethod -Uri "$base/api/V8Engine/AnalyzeWorkflow?osClient=lsg" -Method Post -Headers $h -Body $body -ContentType 'application/json' -TimeoutSec 10 } | Out-Null
Test-Endpoint "GetHotPaths" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetHotPaths?osClient=lsg" -Method Post -Headers $h -Body $body -ContentType 'application/json' -TimeoutSec 10 } | Out-Null
Test-Endpoint "GetBottlenecks" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetBottlenecks?osClient=lsg" -Method Post -Headers $h -Body (@{FlowDesignId='non-existent-id';TopN=5}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 } | Out-Null
Test-Endpoint "GetSlaViolations" { Invoke-RestMethod -Uri "$base/api/V8Engine/GetSlaViolations?osClient=lsg" -Method Post -Headers $h -Body (@{FlowDesignId='non-existent-id';SlaMinutes=60;PageSize=20}|ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 10 } | Out-Null

# === 汇总 ===
Write-Host "`n=== 汇总: ✅ $pass 通过 / ❌ $fail 失败 ===" -ForegroundColor $(if($fail -eq 0){'Green'}else{'Yellow'})
exit $fail
