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

const inwardSet = new Set();
const rejectedSet = new Set();
const movedSet = new Set();
const csSet = new Set();

data.forEach(d => {
  const inv = String(d['INWARD'] || '').trim();
  if (inv) inwardSet.add(inv);

  const status = String(d['RING STATUS'] || '').trim().toLowerCase();
  if (['rejected','nok','fail','0','false','no'].includes(status)) {
    const uid = String(d['UID'] || '').trim();
    if (uid) rejectedSet.add(uid);
  }

  const mv = String(d['MOVED TO INVENTORY'] || '').trim();
  if (mv) movedSet.add(mv);

  const cs = String(d['CS REJECTION UID'] || '').trim();
  if (cs) csSet.add(cs);
});

// Check user's serials
const userSerials = ['RA-CH2-IR4-WB-RT09-0002402', 'RA-CH2-IR3-WB-RT10-0002354'];

console.log('=== CHECKING USERS SERIALS ===');
userSerials.forEach(s => {
  console.log('');
  console.log('Serial: ' + s);
  console.log('  INWARD serial?         ' + (inwardSet.has(s) ? 'YES' : 'NO'));
  console.log('  REJECTED UID?          ' + (rejectedSet.has(s) ? 'YES' : 'NO'));
  console.log('  MOVED TO INVENTORY?    ' + (movedSet.has(s) ? 'YES' : 'NO'));
  console.log('  CS REJECTION UID?      ' + (csSet.has(s) ? 'YES' : 'NO'));

  if (inwardSet.has(s)) {
    const row = data.find(d => String(d['INWARD'] || '').trim() === s);
    if (row) {
      console.log('  Row UID:   ' + row['UID']);
      console.log('  Row STATUS: ' + row['RING STATUS']);
      console.log('  Row MOVED:  ' + row['MOVED TO INVENTORY']);
      console.log('  Row CS_UID: ' + row['CS REJECTION UID']);
    }
  }
});

// Check my serials
const mySerials = ['RA-CH2-IR4-WB-RT09-0002546', 'RA-CH2-IR3-WB-RT10-0002354'];

console.log('');
console.log('=== CHECKING MY SERIALS ===');
mySerials.forEach(s => {
  console.log('');
  console.log('Serial: ' + s);
  console.log('  INWARD serial?         ' + (inwardSet.has(s) ? 'YES' : 'NO'));
  console.log('  REJECTED UID?          ' + (rejectedSet.has(s) ? 'YES' : 'NO'));
  console.log('  MOVED TO INVENTORY?    ' + (movedSet.has(s) ? 'YES' : 'NO'));
  console.log('  CS REJECTION UID?      ' + (csSet.has(s) ? 'YES' : 'NO'));

  if (inwardSet.has(s)) {
    const row = data.find(d => String(d['INWARD'] || '').trim() === s);
    if (row) {
      console.log('  Row UID:   ' + row['UID']);
      console.log('  Row STATUS: ' + row['RING STATUS']);
      console.log('  Row MOVED:  ' + row['MOVED TO INVENTORY']);
      console.log('  Row CS_UID: ' + row['CS REJECTION UID']);
    }
  }
});

// Now the per-row approach
console.log('');
console.log('=== PER-ROW WIP ANALYSIS ===');
console.log('INWARD rows where NONE of rejected/moved/cs applies:');
const wipRows = [];
data.forEach(d => {
  const inv = String(d['INWARD'] || '').trim();
  if (!inv) return;
  
  const status = String(d['RING STATUS'] || '').trim().toLowerCase();
  const moved = String(d['MOVED TO INVENTORY'] || '').trim();
  const csUid = String(d['CS REJECTION UID'] || '').trim();
  const isRejected = ['rejected','nok','fail','0','false','no'].includes(status);
  
  if (!isRejected && !moved && !csUid) {
    wipRows.push({
      inward: inv,
      uid: String(d['UID'] || '').trim(),
      status: String(d['RING STATUS'] || '').trim(),
      reason: String(d['REASON'] || '').trim()
    });
  }
});

console.log('Count: ' + wipRows.length);
wipRows.forEach(w => {
  console.log('  INWARD=' + w.inward + ' | UID=' + w.uid + ' | STATUS=' + w.status);
});

// Also check: maybe the logic should be different
// Take inward serials, remove ones whwre the SAME serial appears as UID in completed rows
console.log('');
console.log('=== CROSS-ROW WIP ANALYSIS ===');
console.log('Taking each INWARD serial, checking if it appears as UID in a completed row...');

const completedUids = new Set();
data.forEach(d => {
  const uid = String(d['UID'] || '').trim();
  if (!uid) return;
  const status = String(d['RING STATUS'] || '').trim().toLowerCase();
  const moved = String(d['MOVED TO INVENTORY'] || '').trim();
  const csUid = String(d['CS REJECTION UID'] || '').trim();
  const isRejected = ['rejected','nok','fail','0','false','no'].includes(status);
  if (isRejected || moved || csUid) {
    completedUids.add(uid);
  }
});

const wipCross = [...inwardSet].filter(inv => !completedUids.has(inv));
console.log('WIP (inward serials not found as completed UID): ' + wipCross.length);
wipCross.forEach(s => console.log('  ' + s));

// Check user's specific serials in this logic
console.log('');
console.log('=== USER SERIALS IN CROSS-ROW LOGIC ===');
userSerials.forEach(s => {
  console.log('  ' + s + ' in completedUids? ' + (completedUids.has(s) ? 'YES - would be excluded' : 'NO - is WIP'));
  console.log('  ' + s + ' in inwardSet? ' + (inwardSet.has(s) ? 'YES' : 'NO'));
});
