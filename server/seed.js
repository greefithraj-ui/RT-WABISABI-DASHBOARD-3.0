import { getDb, saveSheetData } from './db.js';
import { syncSheet } from './sync.js';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1kId06QCUh6YhxeiX8QuPiimBr02ADwX8KPRp6FLxIcg/edit?gid=575402539#gid=575402539';
const SHEETS = ['RT CONVERSION', 'WABI SABI'];

export async function seedDatabase() {
  const db = await getDb();
  for (const sheetName of SHEETS) {
    const existing = db.prepare('SELECT id FROM sheet_data WHERE sheet_name = ? ORDER BY id DESC LIMIT 1');
    existing.bind([sheetName]);
    const hasData = existing.step();
    existing.free();
    if (hasData) continue;

    console.log(`Seeding "${sheetName}" from Google Sheets...`);
    try {
      const result = await syncSheet(SHEET_URL, sheetName);
      console.log(`Seeded ${result.data.length} rows for "${sheetName}"`);
    } catch (err) {
      console.warn(`Failed to seed "${sheetName}": ${err.message}`);
    }
  }
}
