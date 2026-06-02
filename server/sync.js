import { saveSheetData, updateSyncStatus } from './db.js';

const syncJobs = new Map();

export function startAutoSync(sheetUrl, sheetName, intervalMs = 60000) {
  stopAutoSync(sheetName);

  const interval = setInterval(async () => {
    try {
      await syncSheet(sheetUrl, sheetName);
    } catch (err) {
      console.error('Auto-sync error:', err.message);
    }
  }, intervalMs);

  syncJobs.set(sheetName, interval);
  console.log(`Auto-sync started every ${intervalMs / 1000}s for ${sheetName}`);
}

export function stopAutoSync(sheetName) {
  if (sheetName) {
    const interval = syncJobs.get(sheetName);
    if (interval) {
      clearInterval(interval);
      syncJobs.delete(sheetName);
      console.log(`Auto-sync stopped for ${sheetName}`);
    }
    return;
  }

  for (const interval of syncJobs.values()) {
    clearInterval(interval);
  }
  syncJobs.clear();
  console.log('Auto-sync stopped');
}

export async function syncSheet(sheetUrl, sheetName) {
  const match = sheetUrl.match(/\/d\/(.*?)(\/|$)/);
  if (!match) throw new Error('Invalid Google Sheet URL');
  const spreadsheetId = match[1];

  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(csvUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.statusText}`);
  }

  const csvText = await response.text();

  const { default: Papa } = await import('papaparse');

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          updateSyncStatus(sheetUrl, sheetName, 'error', 0, results.errors[0].message)
            .catch(() => {});
          reject(new Error('CSV parsing failed: ' + results.errors[0].message));
          return;
        }

        const rawData = results.data;
        const headers = results.meta.fields || [];

        Promise.all([
          saveSheetData(sheetName, rawData, headers),
          updateSyncStatus(sheetUrl, sheetName, 'success', rawData.length, null)
        ]).then(([changed]) => {
          console.log(`${changed ? 'Synced' : 'Checked'} ${rawData.length} rows from "${sheetName}" at ${new Date().toLocaleTimeString()}`);
          resolve({ data: rawData, headers, changed });
        }).catch((err) => {
          reject(err);
        });
      },
      error: (error) => {
        updateSyncStatus(sheetUrl, sheetName, 'error', 0, error.message)
          .catch(() => {});
        reject(error);
      }
    });
  });
}
