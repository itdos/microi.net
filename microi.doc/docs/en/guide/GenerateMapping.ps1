$mappingFilePath = "mapping.json"

# 初始化现有的映射数据
$existingMapping = @{}

# 检查 mapping.json 文件是否存在，并加载现有数据
if (Test-Path $mappingFilePath) {
    $existingJson = Get-Content -Path $mappingFilePath -Raw
    $existingMapping = $existingJson | ConvertFrom-Json 
}

# 获取当前目录下的文件夹和.md文件
$items = Get-ChildItem -Path (Get-Location) -Recurse | Where-Object { $_.PSIsContainer -or $_.Extension -eq '.md' }

foreach ($item in $items) {
    # 使用文件或文件夹的名称作为键
    $name = $item.Name
    # 如果键不存在，则添加键
    if ($null -eq $existingMapping.$name) {
        $existingMapping | Add-Member -Type NoteProperty -Name $name -Value ""
    }
}

# 将更新后的映射转换为 JSON
$updatedJson = $existingMapping | ConvertTo-Json -Depth 100

# 保存到 mapping.json 文件
$updatedJson | Out-File -FilePath $mappingFilePath -Encoding utf8

Write-Host "文件夹和.md格式的文件名称已更新至 mapping.json。"