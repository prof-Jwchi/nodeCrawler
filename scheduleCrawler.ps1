# 작업 스케줄러에 매 10분마다 crawlAdvanced.js 실행 등록

$action = New-ScheduledTaskAction `
    -Execute "node" `
    -Argument "nodeCrawler\crawlAdvanced.js" `
    -WorkingDirectory "D:\src\crawler\node_crawler"

# 매 10분마다 반복 실행 (1년간)
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 10) `
    -RepetitionDuration (New-TimeSpan -Days 365)

# 작업 등록
Register-ScheduledTask `
    -TaskName "NodeCrawler_10min" `
    -Action $action `
    -Trigger $trigger `
    -Description "매 10분마다 크롤러 실행" `
    -RunLevel Highest

Write-Host "작업 스케줄러에 등록되었습니다: NodeCrawler_10min"
Write-Host "매 10분마다 nodeCrawler\crawlAdvanced.js가 실행됩니다."

