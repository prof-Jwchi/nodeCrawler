# 작업 스케줄러에 등록된 두 작업 다시 활성화

# 작업 활성화
Enable-ScheduledTask -TaskName "NodeCrawler_10min"
Enable-ScheduledTask -TaskName "sendWebhook_10min"

Write-Host "작업이 다시 활성화되었습니다:"
Write-Host "  - NodeCrawler_10min"
Write-Host "  - sendWebhook_10min"

