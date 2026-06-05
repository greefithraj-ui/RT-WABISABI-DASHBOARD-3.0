import initSqlJs from 'sql.js';
import fs from 'fs';
const SQL = await initSqlJs();
const buf = fs.readFileSync('C:/Users/karth/OneDrive/Music/RT CONVERSION/RT-WABI-SABI-DASHBOARD-0.3/server/data.db');
const db = new SQL.Database(buf);
const stmt = db.prepare('SELECT raw_json FROM sheet_data WHERE sheet_name = ? ORDER BY id DESC LIMIT 1');
stmt.bind(['RT CONVERSION']);
stmt.step();
const r = stmt.getAsObject();
const data = JSON.parse(r.raw_json);
stmt.free();
db.close();

// Count based formula: rows with INWARD but NO rejection AND NO moved AND NO CS
let count = 0;
const wipRows = [];
data.forEach(d => {
  const inv = String(d['INWARD'] || '').trim();
  if (!inv) return;

  const status = String(d['RING STATUS'] || '').trim().toLowerCase();
  const moved = String(d['MOVED TO INVENTORY'] || '').trim();
  const csUid = String(d['CS REJECTION UID'] || '').trim();
  const isRejected = ['rejected','nok','fail','0','false','no'].includes(status);

  if (!isRejected && !moved && !csUid) {
    count++;
    wipRows.push({
      inward: inv,
      uid: String(d['UID'] || '').trim(),
      status: String(d['RING STATUS'] || '').trim(),
      moved,
      csUid
    });
  }
});

console.log('Rows with INWARD but no REJECTED/MOVED/CS: ' + count);
console.log('');
wipRows.forEach((r, i) => {
  console.log('[' + (i+1) + '] INWARD=' + r.inward + ' | UID=' + r.uid + ' | STATUS=' + r.status + ' | MOVED="' + r.moved + '" | CS_UID="' + r.csUid + '"');
});
