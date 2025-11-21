import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';


const targetDir = process.cwd(); 
let text = ''; 
const extractDateFromFilename = (filename) => {
  const match = filename.match(/kopo_admission_(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json/);
  if (!match) return null;
  // 2025-11-20T12-03-54-894Z -> 2025-11-20T12:03:54.894Z
  const dateStr = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  return new Date(dateStr);
};

// 행 키 생성 (모집과정|대학|학과|모집구분)
const buildRowKey = (row) => {
  return `${row['모집과정']}|${row['대학']}|${row['학과']}|${row['모집구분']}`;
};

// 접수인원 비교 함수
const compareAdmissionNumbers = (latestData, previousData) => {
  const changes = [];
  const latestMap = new Map();
  const previousMap = new Map();

  if (Array.isArray(latestData)) {
    latestData.forEach((row) => {
      latestMap.set(buildRowKey(row), row);
    });
  }

  if (Array.isArray(previousData)) {
    previousData.forEach((row) => {
      previousMap.set(buildRowKey(row), row);
    });
  }

  // 모든 키 수집
  const allKeys = new Set([...latestMap.keys(), ...previousMap.keys()]);

  allKeys.forEach((key) => {
    const latestRow = latestMap.get(key);
    const previousRow = previousMap.get(key);

    const latestCount = latestRow ? parseInt(latestRow['접수인원'] || '0', 10) : 0;
    const previousCount = previousRow ? parseInt(previousRow['접수인원'] || '0', 10) : 0;

    if (latestCount !== previousCount) {
      changes.push({
        key,
        모집과정: latestRow?.['모집과정'] || previousRow?.['모집과정'],
        대학: latestRow?.['대학'] || previousRow?.['대학'],
        학과: latestRow?.['학과'] || previousRow?.['학과'],
        모집구분: latestRow?.['모집구분'] || previousRow?.['모집구분'],
        이전접수인원: previousCount,
        현재접수인원: latestCount,
        변화량: latestCount - previousCount,
      });
    }
  });

  return changes;
};

fs.readdir(targetDir, { withFileTypes: true }, (err, entries) => {
  if (err) {
    console.error('디렉터리 읽기 오류:', err);
    process.exit(1);
  }

  // JSON 파일들 수집
  const jsonFiles = [];
  entries.forEach((entry) => {
    const fullPath = path.join(targetDir, entry.name);
    if (!entry.isDirectory()) {
      const ext = path.extname(fullPath);
      if (ext === '.json' && entry.name.startsWith('kopo_admission_')) {
        const fileDate = extractDateFromFilename(entry.name);
        if (fileDate) {
          jsonFiles.push({
            name: entry.name,
            path: fullPath,
            date: fileDate,
          });
        }
      }
    }
  });

  // 날짜순으로 정렬 (최신이 앞에)
  jsonFiles.sort((a, b) => b.date - a.date);

  if (jsonFiles.length < 2) {
    console.log('비교할 JSON 파일이 2개 미만입니다.');
    return;
  }

  // 가장 최근 2개 파일
  const latestFile = jsonFiles[0];
  const previousFile = jsonFiles[1];

  console.log(`[비교] 최신: ${latestFile.name}`);
  console.log(`[비교] 이전: ${previousFile.name}`);

  try {
    const latestData = JSON.parse(fs.readFileSync(latestFile.path, 'utf8'));
    const previousData = JSON.parse(fs.readFileSync(previousFile.path, 'utf8'));

    const changes = compareAdmissionNumbers(latestData, previousData);

    if (changes.length === 0) {
      console.log('[결과] 접수인원 변동 없음');
    } else {
      console.log(`[결과] 접수인원 변동: ${changes.length}건`);
      changes.forEach((change) => {
        text += `  - ${change.학과} (${change.모집구분}): ${change.이전접수인원} → ${change.현재접수인원} (${change.변화량 > 0 ? '+' : ''}${change.변화량})\n`;
        console.log(
          `  - ${change.학과} (${change.모집구분}): ${change.이전접수인원} → ${change.현재접수인원} (${change.변화량 > 0 ? '+' : ''}${change.변화량})`,
        );
      });
      
      // text가 설정된 후에 payload 생성 및 전송
      const payload = {
        message: 'Send Web Hook',
        sentAt: new Date().toISOString(),
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              type: 'AdaptiveCard',
              version: '1.4',
              body: [
                {
                  type: 'TextBlock',
                  text: `접수인원 변동 알림`,
                  weight: 'Bolder',
                  size: 'Medium',
                },
                {
                  type: 'TextBlock',
                  text: `${text}`,
                  wrap: true,
                },
              ],
            },
          },
        ],
      };
      sendTestMessage(payload);
    }
  } catch (error) {
    console.error('파일 읽기/비교 중 오류:', error.message);
  }
});

const WEBHOOK_URL =
  process.env.WEBHOOK_URL ??
  'https://defaultad21525cfc0f4dbca40367ce00add0.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/0f895f499cd84c5992e572d73f7259e9/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=eZvhFiIAJ3jTvoYUIxQ-a84oAowQsfZxHkjaFUC9NGg';

if (!WEBHOOK_URL) {
  console.error('WEBHOOK_URL 값이 비어 있습니다.');
  process.exit(1);
}

const getFetch = (() => {
  if (typeof fetch === 'function') {
    return async () => fetch;
  }

  let cached = null;
  return async () => {
    if (!cached) {
      const mod = await import('node-fetch');
      cached = mod.default;
    }
    return cached;
  };
})();

const sendTestMessage = async (payload) => {
  try {
    const payloadString = JSON.stringify(payload);
    console.log("sendTestMessage" + payloadString);
    const fetcher = await getFetch();
    const response = await fetcher(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Webhook 호출 실패 (${response.status} ${response.statusText}): ${body}`,
      );
    }

    console.log('Webhook에 테스트 메시지를 전송했습니다.');
  } catch (error) {
    console.error('전송 중 오류가 발생했습니다:', error.message);
    process.exitCode = 1;
  }
};


