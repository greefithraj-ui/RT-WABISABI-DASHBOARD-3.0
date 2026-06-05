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

// WIP = UIDs that are ACCEPTED but NOT moved to inventory AND NOT CS rejected
const acceptedButNotCompleted = [];
data.forEach(d => {
  const uid = String(d['UID'] || '').trim();
  if (!uid) return;
  
  const status = String(d['RING STATUS'] || '').trim().toLowerCase();
  const moved = String(d['MOVED TO INVENTORY'] || '').trim();
  const csUid = String(d['CS REJECTION UID'] || '').trim();
  
  const isAccepted = ['accepted', 'ok', 'pass', '1', 'true', 'yes'].includes(status);
  const isCompleted = moved !== '' || csUid !== '';
  
  if (isAccepted && !isCompleted) {
    acceptedButNotCompleted.push({ uid, moved, csUid, status: d['RING STATUS'] });
  }
});

console.log('=== WIP: ACCEPTED UIDs not moved and not CS rejected ===');
console.log('Count: ' + acceptedButNotCompleted.length);
acceptedButNotCompleted.forEach(w => console.log('  UID=' + w.uid + ' | MOVED="' + w.moved + '" | CS_UID="' + w.csUid + '"'));

console.log('');
console.log('');

// Also check: WIP = UIDs where status is NOT rejected and NOT moved and NOT CS
// (could be ACCEPTED or empty status)
const notRejectedNotMovedNotCs = [];
data.forEach(d => {
  const uid = String(d['UID'] || '').trim();
  if (!uid) return;
  
  const status = String(d['RING STATUS'] || '').trim().toLowerCase();
  const moved = String(d['MOVED TO INVENTORY'] || '').trim();
  const csUid = String(d['CS REJECTION UID'] || '').trim();
  
  const isRejected = ['rejected', 'nok', 'fail', '0', 'false', 'no'].includes(status);
  
  if (!isRejected && moved === '' && csUid === '') {
    notRejectedNotMovedNotCs.push({ uid, status: d['RING STATUS'], moved, csUid });
  }
});

console.log('=== WIP: UIDs not rejected, not moved, not CS ===');
console.log('Count: ' + notRejectedNotMovedNotCs.length);
notRejectedNotMovedNotCs.forEach(w => console.log('  UID=' + w.uid + ' | STATUS="' + w.status + '" | MOVED="' + w.moved + '" | CS_UID="' + w.csUid + '"'));
