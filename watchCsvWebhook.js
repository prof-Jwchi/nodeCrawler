import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CSV_PATH = path.resolve(
  process.env.CSV_PATH ?? path.join(process.cwd(), 'kopo_admission_2025-11-19.csv'),
);
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? 'https://defaultad21525cfc0f4dbca40367ce00add0.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b3db4990318148a9b396840095c46083/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=W-T94cDka62t76b5ujyDP5UudfWWFuKXVsEO99bfhfQ';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 2000);

if (!WEBHOOK_URL) {
  console.error('WEBHOOK_URL 환경 변수가 비어 있습니다. 종료합니다.');
  process.exit(1);
}

let previousSnapshot = null;
let debounceTimer = null;
let isReading = false;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeNumber = (value) => {
  if (typeof value !== 'string') {
    return Number.isFinite(value) ? Number(value) : null;
  }

  const numericOnly = value.replace(/[^\d.-]/g, '');
  if (!numericOnly.length) {
    return null;
  }

  const parsed = Number(numericOnly);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCsv = (content) => {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const columns = line.split(',').map((column) => column.trim());
    return headers.reduce((acc, header, index) => {
      acc[header] = columns[index] ?? '';
      return acc;
    }, {});
  });
};

const buildRowKey = (row) => {
  const keyColumns = ['모집과정', '대학', '학과', '모집구분'];
  return keyColumns.map((column) => row[column] ?? '').join('|');
};

const takeSnapshot = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    map.set(buildRowKey(row), row);
  });
  return map;
};

const diffSnapshots = (previous, current) => {
  const changes = [];
  const allKeys = new Set([...previous.keys(), ...current.keys()]);

  allKeys.forEach((key) => {
    const prevRow = previous.get(key);
    const currRow = current.get(key);

    if (!prevRow && currRow) {
      Object.entries(currRow).forEach(([column, value]) => {
        const numeric = sanitizeNumber(value);
        if (numeric !== null) {
          changes.push({
            type: 'added',
            rowKey: key,
            column,
            newValue: numeric,
          });
        }
      });
      return;
    }

    if (prevRow && !currRow) {
      Object.entries(prevRow).forEach(([column, value]) => {
        const numeric = sanitizeNumber(value);
        if (numeric !== null) {
          changes.push({
            type: 'removed',
            rowKey: key,
            column,
            oldValue: numeric,
          });
        }
      });
      return;
    }

    Object.entries(currRow).forEach(([column, currValue]) => {
      const newNumber = sanitizeNumber(currValue);
      if (newNumber === null) {
        return;
      }

      const oldNumber = sanitizeNumber(prevRow[column]);
      if (oldNumber === null) {
        changes.push({
          type: 'added',
          rowKey: key,
          column,
          newValue: newNumber,
        });
        return;
      }

      if (oldNumber !== newNumber) {
        changes.push({
          type: 'updated',
          rowKey: key,
          column,
          oldValue: oldNumber,
          newValue: newNumber,
        });
      }
    });
  });

  return changes;
};

const sendWebhook = async (payload) => {
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
};

const processFile = async () => {
  if (isReading) {
    return;
  }

  isReading = true;

  try {
    const csvContent = await fs.promises.readFile(CSV_PATH, 'utf8');
    const rows = parseCsv(csvContent);
    const currentSnapshot = takeSnapshot(rows);

    if (!previousSnapshot) {
      previousSnapshot = currentSnapshot;
      console.log(`[INIT] ${CSV_PATH} 기반 스냅샷 생성`);
      return;
    }

    const changes = diffSnapshots(previousSnapshot, currentSnapshot);
    if (!changes.length) {
      return;
    }

    console.log(`[CHANGE] ${changes.length}개의 수치 변동 발견, webhook 전송`);
    await sendWebhook({
      file: path.basename(CSV_PATH),
      detectedAt: new Date().toISOString(),
      changes,
    });

    previousSnapshot = currentSnapshot;
  } catch (error) {
    console.error('[ERROR]', error.message);
  } finally {
    isReading = false;
  }
};

const scheduleProcess = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    processFile();
  }, POLL_INTERVAL_MS);
};

const ensureFileExists = async () => {
  while (true) {
    try {
      await fs.promises.access(CSV_PATH, fs.constants.F_OK);
      break;
    } catch {
      console.log(`${CSV_PATH} 파일을 찾을 수 없습니다. 3초 후 재시도합니다.`);
      await sleep(3000);
    }
  }
};

const bootstrap = async () => {
  await ensureFileExists();
  await processFile();

  fs.watch(CSV_PATH, { persistent: true }, () => {
    console.log('[WATCHER] 파일 변경 감지');
    scheduleProcess();
  });

  console.log(
    `감시 시작: ${CSV_PATH} (주기 ${POLL_INTERVAL_MS}ms, webhook ${WEBHOOK_URL})`,
  );
};

bootstrap().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});



