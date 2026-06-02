import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data.db');

let db = null;

function createFreshDb(SQL) {
  const d = new SQL.Database();
  d.run(`
    CREATE TABLE IF NOT EXISTS sheet_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL DEFAULT '',
      raw_json TEXT NOT NULL,
      headers_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_url TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      last_sync_at TEXT,
      row_count INTEGER DEFAULT 0,
      error_message TEXT
    )
  `);
  return d;
}

export async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  try {
    const fileBuffer = fs.readFileSync(dbPath);
    try {
      db = new SQL.Database(fileBuffer);
      initSchema();
    } catch {
      console.warn('Database file corrupt, creating fresh database');
      db = createFreshDb(SQL);
      saveDb();
    }
  } catch {
    db = createFreshDb(SQL);
    saveDb();
  }

  return db;
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS sheet_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL DEFAULT '',
      raw_json TEXT NOT NULL,
      headers_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_url TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      last_sync_at TEXT,
      row_count INTEGER DEFAULT 0,
      error_message TEXT
    )
  `);

  saveDb();
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Failed to save database file:', err.message);
  }
}

export async function saveSheetData(sheetName, rawData, headers) {
  const d = await getDb();
  const rawJson = JSON.stringify(rawData);
  const headersJson = JSON.stringify(headers);

  const latest = d.prepare(`
    SELECT raw_json, headers_json FROM sheet_data
    WHERE sheet_name = ?
    ORDER BY id DESC LIMIT 1
  `);
  latest.bind([sheetName]);
  if (latest.step()) {
    const cols = latest.getAsObject();
    latest.free();
    if (cols.raw_json === rawJson && cols.headers_json === headersJson) {
      return false;
    }
  } else {
    latest.free();
  }

  d.run(`
    INSERT INTO sheet_data (sheet_name, raw_json, headers_json, fetched_at)
    VALUES (?, ?, ?, datetime('now'))
  `, [sheetName, rawJson, headersJson]);
  saveDb();
  return true;
}

export async function getLatestSheetData(sheetName) {
  const d = await getDb();
  const stmt = d.prepare(`
    SELECT raw_json, headers_json, fetched_at FROM sheet_data
    WHERE sheet_name = ?
    ORDER BY id DESC LIMIT 1
  `);
  stmt.bind([sheetName]);
  let row = null;
  if (stmt.step()) {
    const cols = stmt.getAsObject();
    row = {
      data: JSON.parse(cols.raw_json),
      headers: JSON.parse(cols.headers_json),
      fetchedAt: cols.fetched_at
    };
  }
  stmt.free();
  return row;
}

export async function updateSyncStatus(sheetUrl, sheetName, status, rowCount, errorMessage) {
  const d = await getDb();
  const existing = d.prepare(`
    SELECT id FROM sync_status WHERE sheet_url = ? AND sheet_name = ?
  `);
  existing.bind([sheetUrl, sheetName]);
  let exists = null;
  if (existing.step()) {
    exists = existing.getAsObject();
  }
  existing.free();

  if (exists) {
    d.run(`
      UPDATE sync_status SET status = ?, last_sync_at = datetime('now'),
      row_count = ?, error_message = ? WHERE id = ?
    `, [status, rowCount, errorMessage, exists.id]);
  } else {
    d.run(`
      INSERT INTO sync_status (sheet_url, sheet_name, status, last_sync_at, row_count, error_message)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
    `, [sheetUrl, sheetName, status, rowCount, errorMessage]);
  }
  saveDb();
}

export async function getSyncStatus() {
  const d = await getDb();
  const stmt = d.prepare(`SELECT * FROM sync_status ORDER BY id DESC LIMIT 1`);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row || null;
}
