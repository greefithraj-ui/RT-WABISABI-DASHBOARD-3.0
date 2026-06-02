import { Router } from 'express';

const router = Router();

const PASSWORD = '0369';

router.post('/authenticate', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  if (String(password) !== PASSWORD) {
    return res.status(401).json({ success: false, message: 'Invalid password' });
  }

  const token = Buffer.from(`db_session_${Date.now()}`).toString('base64');
  res.json({ success: true, token });
});

export default router;
