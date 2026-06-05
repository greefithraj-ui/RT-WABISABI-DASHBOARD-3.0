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

// Find all rows where user's serials appear in ANY column
const userSerials = ['RA-CH2-IR4-WB-RT09-0002402', 'RA-CH2-IR3-WB-RT10-0002354'];

userSerials.forEach(serial => {
  console.log('=== Searching for ' + serial + ' ===');
  const matches = data.filter(d => {
    const allVals = Object.values(d).map(v => String(v || '').trim());
    return allVals.some(v => v === serial);
  });
  
  if (matches.length === 0) {
    console.log('  NOT FOUND in any column');
    return;
  }
  
  console.log('  Found in ' + matches.length + ' rows:');
  matches.forEach((d, i) => {
    console.log('  [' + i + '] INWARD=' + d['INWARD'] + ' | UID=' + d['UID'] + ' | STATUS=' + d['RING STATUS'] + ' | MOVED=' + d['MOVED TO INVENTORY'] + ' | CS_UID=' + d['CS REJECTION UID']);
  });
});

// Now find the actual WIP: check ALL serials that appear in the sheet
// and find ones that are in INWARD but NOT in any completed state

// Build a map of every serial in the sheet to its status
const serialInfo = {};
data.forEach(d => {
  const inv = String(d['INWARD'] || '').trim();
  const uid = String(d['UID'] || '').trim();
  const status = String(d['RING STATUS'] || '').trim();
  const moved = String(d['MOVED TO INVENTORY'] || '').trim();
  const cs = String(d['CS REJECTION UID'] || '').trim();
  const reason = String(d['REASON'] || '').trim();
  
  // Track completion for each serial
  const isRejected = ['rejected','nok','fail','0','false','no'].includes(status.toLowerCase());
  
  [inv, uid, moved, cs].filter(Boolean).forEach(s => {
    if (!serialInfo[s]) serialInfo[s] = { inward: false, completed: false };
    if (s === inv) serialInfo[s].inward = true;
    if (isRejected || s === moved || s === cs || (s === uid && (moved || cs || isRejected))) {
      serialInfo[s].completed = true;
    }
  });
});

// WIP = serials that appear as INWARD but are not completed
const wipSerials = Object.entries(serialInfo)
  .filter(([s, info]) => info.inward && !info.completed)
  .map(([s]) => s);

console.log('');
console.log('=== WIP using full cross-reference ===');
console.log('Count: ' + wipSerials.length);
wipSerials.forEach(s => console.log('  ' + s));
