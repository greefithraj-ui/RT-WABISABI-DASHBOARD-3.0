const API_BASE = '/api';

async function readApiResponse(res: Response) {
  const text = await res.text();
  let data: any = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned invalid JSON (${res.status} ${res.statusText})`);
    }
  }

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status} ${res.statusText})`);
  }

  return data;
}

export async function authenticate(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await readApiResponse(res);
  if (!data.success) throw new Error(data.message || 'Authentication failed');
  return data.token;
}

export async function fetchFromDatabase(token: string, sheetName: string) {
  const res = await fetch(`${API_BASE}/data?sheetName=${encodeURIComponent(sheetName)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await readApiResponse(res);
  if (!data.success) throw new Error(data.message || 'Failed to fetch data');
  return { data: data.data, headers: data.headers, fetchedAt: data.fetchedAt };
}

export async function triggerSync(token: string, url: string, sheetName: string) {
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, sheetName })
  });
  const data = await readApiResponse(res);
  if (!data.success) throw new Error(data.message || 'Sync failed');
  return { data: data.data, headers: data.headers };
}

export async function getSyncStatus(token: string) {
  const res = await fetch(`${API_BASE}/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await readApiResponse(res);
  if (!data.success) throw new Error(data.message || 'Failed to get status');
  return data.status;
}
