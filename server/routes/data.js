import { Router } from 'express';
import { getLatestSheetData, getSyncStatus } from '../db.js';
import { syncSheet, startAutoSync, stopAutoSync } from '../sync.js';

const router = Router();

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  next();
}

router.get('/data', requireAuth, async (req, res) => {
  const sheetName = req.query.sheetName || '';
  try {
    const result = await getLatestSheetData(sheetName);
    if (!result) {
      return res.status(404).json({ success: false, message: 'No data found. Perform a sync first.' });
    }
    res.json({ success: true, data: result.data, headers: result.headers, fetchedAt: result.fetchedAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sync', requireAuth, async (req, res) => {
  const { url, sheetName } = req.body;
  if (!url || !sheetName) {
    return res.status(400).json({ success: false, message: 'URL and sheetName are required' });
  }
  try {
    const result = await syncSheet(url, sheetName);
    startAutoSync(url, sheetName, 5000);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/status', requireAuth, async (req, res) => {
  try {
    const status = await getSyncStatus();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
