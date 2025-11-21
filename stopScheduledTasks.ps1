# 작업 스케줄러에 등록된 두 작업 중지 (비활성화)

# 작업 비활성화
Disable-ScheduledTask -TaskName "NodeCrawler_10min"
Disable-ScheduledTask -TaskName "sendWebhook_10min"

Write-Host "작업이 비활성화되었습니다:"
Write-Host "  - NodeCrawler_10min"
Write-Host "  - sendWebhook_10min"
Write-Host ""
Write-Host "다시 활성화하려면 startScheduledTasks.ps1를 실행하세요."

