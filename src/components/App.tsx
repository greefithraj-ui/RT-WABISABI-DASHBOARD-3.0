import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { Menu, AlertCircle, RefreshCw, Database, Copy, Check, Layout, KeyRound, Eye, EyeOff } from 'lucide-react';
import { INITIAL_CONFIG, DEFAULT_MAPPING } from '../constants';
import { SheetConfig, DashboardRow, KPIStats, SKUDetail } from '../types';
import { fetchSheetData, parseDate } from '../services/sheetService';
import { authenticate, fetchFromDatabase, triggerSync } from '../services/dbService';
import KPIGrid from './KPIGrid';
import FilterSection from './FilterSection';
import SKUDetailsSection from './SKUDetailsSection';
import SKUCountCharts from './SKUCountCharts';
import WipDrilldownModal from './WipDrilldownModal';
import SerialListModal from './SerialListModal';
import RejectionDetailsSection from './RejectionDetailsSection';
import RejectionDrilldownModal from './RejectionDrilldownModal';
import AcceptedDrilldownModal from './AcceptedDrilldownModal';
import SettingsMenu from './SettingsMenu';
import DatabaseAuthModal from './DatabaseAuthModal';
import { useDebounce } from '../hooks/useDebounce';

// Memoize heavy components
const MemoizedKPIGrid = memo(KPIGrid);
const MemoizedFilterSection = memo(FilterSection);
const MemoizedSKUDetailsSection = memo(SKUDetailsSection);
const MemoizedSKUCountCharts = memo(SKUCountCharts);
const MemoizedRejectionDetailsSection = memo(RejectionDetailsSection);
const MemoizedWipDrilldownModal = memo(WipDrilldownModal);
const MemoizedSerialListModal = memo(SerialListModal);
const MemoizedRejectionDrilldownModal = memo(RejectionDrilldownModal);
const MemoizedAcceptedDrilldownModal = memo(AcceptedDrilldownModal);

const MemoizedSettingsMenu = memo(SettingsMenu);
const MemoizedDatabaseAuthModal = memo(DatabaseAuthModal);

type SheetCacheEntry = {
  data: DashboardRow[];
  headers: string[];
  lastSyncTime: Date;
};

const hydrateCachedRows = (rows: DashboardRow[]) => rows.map(row => ({
  ...row,
  date: row.date ? new Date(row.date) : null,
  _parsedDate: row._parsedDate ? new Date(row._parsedDate) : null,
  _inventoryDate: row._inventoryDate ? new Date(row._inventoryDate) : null,
  _csDate: row._csDate ? new Date(row._csDate) : null
}));

const App: React.FC = () => {
  // Utility for safe local storage operations
  const safeLocalStorageSet = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`LocalStorage quota exceeded for key: ${key}. Clearing cache.`);
        // Try to clear some space or at least remove the key that's failing
        localStorage.removeItem(key);
      } else {
        console.error(`Error saving to LocalStorage for key: ${key}`, e);
      }
      return false;
    }
  }, []);

  const [config, setConfig] = useState<SheetConfig>(() => {
    const saved = localStorage.getItem('qc_dashboard_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            ...INITIAL_CONFIG,
            ...parsed,
            mapping: { ...INITIAL_CONFIG.mapping, ...(parsed.mapping || {}) },
            url: parsed.url || INITIAL_CONFIG.url,
          };
        }
      } catch (e) {
        console.error("Failed to parse config from localStorage", e);
      }
    }
    return INITIAL_CONFIG;
  });
  
  const [data, setData] = useState<DashboardRow[]>(() => {
    const saved = localStorage.getItem('qc_dashboard_cached_data');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      
      // Re-parse dates because JSON.parse turns them into strings
      return hydrateCachedRows(parsed);
    } catch (e) {
      console.error("Failed to parse cached data", e);
      return [];
    }
  });
  const [headers, setHeaders] = useState<string[]>(() => {
    const saved = localStorage.getItem('qc_dashboard_cached_headers');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(() => {
    return localStorage.getItem('qc_dashboard_compact_mode') === 'true';
  });
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'syncing' | null; message: string | null }>({ type: null, message: null });
  const [showDbAuthModal, setShowDbAuthModal] = useState(false);
  const [dbAuthLoading, setDbAuthLoading] = useState(false);
  const [isAppAuthenticated, setIsAppAuthenticated] = useState(() => {
    return sessionStorage.getItem('qc_dashboard_authenticated') === 'true';
  });
  const [showAppAuth, setShowAppAuth] = useState(false);
  const [appAuthPassword, setAppAuthPassword] = useState('');
  const [showAppAuthPassword, setShowAppAuthPassword] = useState(false);
  const [appAuthError, setAppAuthError] = useState<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<DashboardRow[] | null>(null);
  const latestHeadersRef = useRef<string[] | null>(null);
  const latestMappingRef = useRef<any>(null);
  const sheetCacheRef = useRef<Record<string, SheetCacheEntry>>({});

  const syncLatestData = useCallback(() => {
    if (latestDataRef.current) {
      setData(latestDataRef.current);
      if (latestHeadersRef.current) setHeaders(latestHeadersRef.current);
      if (latestMappingRef.current) setConfig(prev => ({ ...prev, mapping: latestMappingRef.current }));
      latestDataRef.current = null;
      latestHeadersRef.current = null;
      latestMappingRef.current = null;
    }
  }, []);

  const setSyncMessage = (type: 'success' | 'error' | 'syncing', message: string) => {
    setSyncStatus({ type, message });
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    if (type !== 'syncing') {
      syncTimeoutRef.current = setTimeout(() => setSyncStatus({ type: null, message: null }), 5000);
    }
  };

  const [selectedBatches, setSelectedBatches] = useState<string[]>(() => {
    const saved = localStorage.getItem('qc_dashboard_selected_batches');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>(() => {
    const saved = localStorage.getItem('qc_dashboard_date_range');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          start: parsed.start ? new Date(parsed.start) : null,
          end: parsed.end ? new Date(parsed.end) : null
        };
      } catch (e) {
        return { start: null, end: null };
      }
    }
    return { start: null, end: null };
  });
  const [uidSearch, setUidSearch] = useState(() => {
    return localStorage.getItem('qc_dashboard_uid_search') || '';
  });
  const debouncedUidSearch = useDebounce(uidSearch, 300);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isAcceptedModalOpen, setIsAcceptedModalOpen] = useState(false);
  const [isWipModalOpen, setIsWipModalOpen] = useState(false);
  const [isMovedModalOpen, setIsMovedModalOpen] = useState(false);
  const [isCsModalOpen, setIsCsModalOpen] = useState(false);

  const handleSetSelectedBatches = useCallback((batches: string[]) => {
    syncLatestData();
    setSelectedBatches(batches);
  }, [syncLatestData]);

  const handleSetDateRange = useCallback((range: { start: Date | null; end: Date | null }) => {
    syncLatestData();
    setDateRange(range);
  }, [syncLatestData]);

  const handleSetUidSearch = useCallback((search: string) => {
    syncLatestData();
    setUidSearch(search);
  }, [syncLatestData]);

  // Robust column detection with priority on SKU
  const findHeaderMatch = useCallback((availableHeaders: string[], searchTerms: string[]): string | undefined => {
    if (!availableHeaders.length) return undefined;
    
    const lowerHeaders = availableHeaders.map(h => h.trim().toLowerCase());
    
    for (const term of searchTerms) {
      const idx = lowerHeaders.indexOf(term.toLowerCase());
      if (idx !== -1) return availableHeaders[idx];
    }

    const contains = availableHeaders.find(h => 
      searchTerms.some(term => h.toLowerCase().includes(term.toLowerCase()))
    );
    if (contains) return contains;

    return availableHeaders.find(h => {
      const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return searchTerms.some(term => {
        const termNorm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalized.includes(termNorm) || termNorm.includes(normalized);
      });
    });
  }, []);

  const autoDetectMapping = useCallback((availableHeaders: string[]) => {
    const mapping = { ...(config.mapping || DEFAULT_MAPPING) };
    
    const aliases = {
      sku: ['sku', 'item', 'part', 'article', 'model', 'product', 'code'],
      batchNo: ['batch', 'lot', 'serial', 'batch no', 'batch number', 'batch id', 'lot no', 'lot id'],
      ringStatus: ['status', 'result', 'outcome', 'quality'],
      uid: ['uid', 'id', 'barcode', 'serial'],
      inward: ['inward', 'qty', 'count', 'total'],
      reason: ['reason', 'rejection', 'defect', 'cause', 'fault'],
      movedToInventory: ['moved to inventory', 'inventory', 'moved'],
      inventoryDate: ['inventory date', 'moved date', 'date moved'],
      inventoryBatch: ['inventory batch', 'batch moved', 'batch inventory'],
      csDate: ['cs date'],
      csRejection: ['cs rejection uid', 'cs rejection'],
      csBatch: ['cs batch'],
      csReason: ['cs reason', 'cs rejection'],
    };

    // 1. Explicitly look for "DATE" column first (case-insensitive)
    const dateHeader = availableHeaders.find(h => h.trim().toUpperCase() === 'DATE');
    if (dateHeader) {
      mapping.date = dateHeader;
    } else {
      // Fallback only if "DATE" is not found, using a very restricted set of aliases
      const fallbackDate = findHeaderMatch(availableHeaders, ['date', 'timestamp', 'day']);
      if (fallbackDate) mapping.date = fallbackDate;
    }

    (Object.entries(aliases) as [keyof typeof aliases, string[]][]).forEach(([key, terms]) => {
      const detected = findHeaderMatch(availableHeaders, terms);
      if (detected) {
        (mapping as any)[key] = detected;
      } else {
        const currentVal = mapping[key as keyof typeof mapping];
        if (!currentVal || !availableHeaders.includes(currentVal)) {
          (mapping as any)[key] = '';
        }
      }
    });

    return mapping;
  }, [config.mapping, findHeaderMatch]);

  const handleSheetSwitch = useCallback((sheetName: string) => {
    if (config.sheetName === sheetName) return;

    let cachedSheet = sheetCacheRef.current[sheetName];
    if (!cachedSheet) {
      const savedSheet = localStorage.getItem(`qc_dashboard_sheet_cache_${sheetName}`);
      if (savedSheet) {
        try {
          const parsed = JSON.parse(savedSheet);
          if (Array.isArray(parsed.data) && Array.isArray(parsed.headers)) {
            cachedSheet = {
              data: hydrateCachedRows(parsed.data),
              headers: parsed.headers,
              lastSyncTime: parsed.lastSyncTime ? new Date(parsed.lastSyncTime) : new Date()
            };
            sheetCacheRef.current[sheetName] = cachedSheet;
          }
        } catch (e) {
          console.warn('Failed to read sheet cache:', e);
        }
      }
    }

    if (cachedSheet) {
      setData(cachedSheet.data);
      setHeaders(cachedSheet.headers);
      setLastSyncTime(cachedSheet.lastSyncTime);
      setError(null);
      setSelectedBatches([]);
      const newMapping = autoDetectMapping(cachedSheet.headers);
      const newConfig = { ...config, sheetName, mapping: newMapping };
      setConfig(newConfig);
      safeLocalStorageSet('qc_dashboard_config', JSON.stringify(newConfig));
      return;
    }

    setSelectedBatches([]);
    
    const newConfig = { ...config, sheetName };
    setConfig(newConfig);
    safeLocalStorageSet('qc_dashboard_config', JSON.stringify(newConfig));
  }, [config, safeLocalStorageSet, autoDetectMapping]);

  const handleConfigUpdate = useCallback((newConfig: SheetConfig) => {
    syncLatestData();
    setConfig(newConfig);
    safeLocalStorageSet('qc_dashboard_config', JSON.stringify(newConfig));
  }, [syncLatestData, safeLocalStorageSet]);

  const requestSettingsOpen = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  // Use a second ref for copy toast timer
  const copyToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced localStorage persistence - batch writes to reduce I/O
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersist = useRef<Record<string, string>>({});

  const flushPersist = useCallback(() => {
    const batch = pendingPersist.current;
    pendingPersist.current = {};
    Object.entries(batch).forEach(([key, value]) => safeLocalStorageSet(key, value));
  }, [safeLocalStorageSet]);

  const schedulePersist = useCallback((key: string, value: string) => {
    pendingPersist.current[key] = value;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(flushPersist, 300);
  }, [flushPersist]);

  useEffect(() => {
    schedulePersist('qc_dashboard_selected_batches', JSON.stringify(selectedBatches));
  }, [selectedBatches, schedulePersist]);

  useEffect(() => {
    schedulePersist('qc_dashboard_date_range', JSON.stringify(dateRange));
  }, [dateRange, schedulePersist]);

  useEffect(() => {
    schedulePersist('qc_dashboard_uid_search', uidSearch);
  }, [uidSearch, schedulePersist]);

  useEffect(() => {
    if (data.length > 0) {
      schedulePersist('qc_dashboard_cached_data', JSON.stringify(data));
    }
  }, [data, schedulePersist]);

  useEffect(() => {
    if (headers.length > 0) {
      schedulePersist('qc_dashboard_cached_headers', JSON.stringify(headers));
    }
  }, [headers, schedulePersist]);

  useEffect(() => {
    schedulePersist('qc_dashboard_compact_mode', String(isCompactMode));
  }, [isCompactMode, schedulePersist]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current);
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
      flushPersist();
    };
  }, [flushPersist]);

  const lastRawData = useRef<Record<string, string>>({});

  const processSheetData = useCallback(async (rawData: DashboardRow[], sheetHeaders: string[], silent: boolean) => {
    const sheetName = config.sheetName;
    const currentDataStr = JSON.stringify(rawData);
    if (silent && currentDataStr === lastRawData.current[sheetName]) {
      setLastSyncTime(new Date());
      return;
    }
    lastRawData.current[sheetName] = currentDataStr;
    setLastSyncTime(new Date());

    setHeaders(sheetHeaders);

    const updatedMapping = autoDetectMapping(sheetHeaders);
    const mappingChanged = JSON.stringify(updatedMapping) !== JSON.stringify(config.mapping);

    if (mappingChanged) {
      setConfig(prev => ({ ...prev, mapping: updatedMapping }));
    }

    const batchCol = updatedMapping.batchNo;
    const hasBatchCol = batchCol && sheetHeaders.includes(batchCol);
    const uniqueBatchesSet = new Set<string>();

    const updatedData = rawData.map(row => {
      const parsedDate = parseDate(String(row[updatedMapping.date] || ''));
      const parsedInventoryDate = parseDate(String(row[updatedMapping.inventoryDate] || ''));
      const parsedCsDate = parseDate(String(row[updatedMapping.csDate] || ''));
      if (hasBatchCol) {
        const batchVal = String(row[batchCol] || '').trim();
        if (batchVal) uniqueBatchesSet.add(batchVal);
      }
      return {
        ...row,
        date: parsedDate,
        _parsedDate: parsedDate,
        _inventoryDate: parsedInventoryDate,
        _csDate: parsedCsDate
      };
    });

    setData(updatedData);
    setHeaders(sheetHeaders);
    sheetCacheRef.current[sheetName] = {
      data: updatedData,
      headers: sheetHeaders,
      lastSyncTime: new Date()
    };
    safeLocalStorageSet(`qc_dashboard_sheet_cache_${sheetName}`, JSON.stringify(sheetCacheRef.current[sheetName]));

    if (hasBatchCol) {
      const uniqueBatches = Array.from(uniqueBatchesSet)
        .sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

      setSelectedBatches(prev => {
        const validSelectedBatches = prev.filter(b => uniqueBatchesSet.has(b));
        if (prev.length === 0 || (validSelectedBatches.length === 0 && uniqueBatches.length > 0)) {
          return uniqueBatches;
        }
        return validSelectedBatches;
      });
    } else {
      setSelectedBatches([]);
    }

    setError(null);
    if (!silent) setSyncMessage('success', 'Data synced successfully');
  }, [config.mapping, config.sheetName, autoDetectMapping, safeLocalStorageSet]);

  const handleDbAuth = useCallback(async (password: string) => {
    setDbAuthLoading(true);
    try {
      const token = await authenticate(password);
      const newConfig = { ...config, dataSource: 'database', dbAuthToken: token };
      setConfig(newConfig);
      safeLocalStorageSet('qc_dashboard_config', JSON.stringify(newConfig));
      setShowDbAuthModal(false);
      setError(null);
      setSyncMessage('syncing', 'Fetching from database...');
      return token;
    } catch (err: any) {
      throw err;
    } finally {
      setDbAuthLoading(false);
    }
  }, [config, safeLocalStorageSet]);

  const preloadOtherSheet = useCallback(async () => {
    const otherSheetName = config.sheetName === 'RT CONVERSION' ? 'WABI SABI' : 'RT CONVERSION';
    if (!config.dbAuthToken || config.dataSource !== 'database') return;
    if (sheetCacheRef.current[otherSheetName]) return;
    try {
      const result = await fetchFromDatabase(config.dbAuthToken, otherSheetName);
      const parsedData = result.data.map((row: DashboardRow) => ({
        ...row,
        date: parseDate(String(row[DEFAULT_MAPPING.date] || '')),
        _parsedDate: parseDate(String(row[DEFAULT_MAPPING.date] || '')),
        _inventoryDate: parseDate(String(row[DEFAULT_MAPPING.inventoryDate] || '')),
        _csDate: parseDate(String(row[DEFAULT_MAPPING.csDate] || ''))
      }));
      sheetCacheRef.current[otherSheetName] = {
        data: parsedData,
        headers: result.headers,
        lastSyncTime: new Date()
      };
      try {
        localStorage.setItem(`qc_dashboard_sheet_cache_${otherSheetName}`, JSON.stringify(sheetCacheRef.current[otherSheetName]));
      } catch (e) {}
    } catch (e) {}
  }, [config.dbAuthToken, config.dataSource, config.sheetName]);

  const loadData = useCallback(async (silent = false) => {
    if (silent && (loading || isBackgroundSyncing)) return;

    if (config.dataSource === 'database') {
      if (!config.dbAuthToken) {
        if (!silent) setError('Database not connected. Open Settings to configure a database connection or switch to Google Sheet mode.');
        return;
      }

      if (!silent) {
        setLoading(true);
        setSyncMessage('syncing', 'Fetching from database...');
      } else {
        setIsBackgroundSyncing(true);
      }

      try {
        if (!silent) {
          try {
            const result = await fetchFromDatabase(config.dbAuthToken, config.sheetName);
            await processSheetData(result.data, result.headers, silent);
            preloadOtherSheet();

            if (config.url) {
              triggerSync(config.dbAuthToken, config.url, config.sheetName)
                .then(syncResult => processSheetData(syncResult.data, syncResult.headers, true))
                .catch((syncErr: any) => console.warn('Background DB sync failed:', syncErr.message));
            }
            return;
          } catch (dbErr) {
            if (!config.url) {
              if (!silent) {
                setError('No data synced yet. Configure a Google Sheet URL in Settings and sync data to get started.');
                setSyncMessage('error', 'No data in database');
              }
              return;
            }
            console.warn('DB fetch failed, syncing sheet now:', (dbErr as Error).message);
          }
        }

        if (config.url) {
          try {
            const syncResult = await triggerSync(config.dbAuthToken, config.url, config.sheetName);
            await processSheetData(syncResult.data, syncResult.headers, silent);
            preloadOtherSheet();
            return;
          } catch (syncErr) {
            console.warn('DB sync failed, falling back to direct fetch:', syncErr.message);
          }
          const result = await fetchFromDatabase(config.dbAuthToken, config.sheetName);
          await processSheetData(result.data, result.headers, silent);
          preloadOtherSheet();
        }
      } catch (err: any) {
        if (!silent) {
          const isNetworkError = err.message === 'Failed to fetch' || err.message.includes('NetworkError');
          setError(isNetworkError
            ? "DATABASE CONNECTION ERROR: Unable to reach the database server"
            : err.message);
          setSyncMessage('error', 'DB fetch failed, showing last data');
        }
      } finally {
        if (!silent) setLoading(false);
        else setIsBackgroundSyncing(false);
      }
      return;
    }

    if (!config.url) {
      if (!silent) setError("CONFIGURATION REQUIRED: Please link a valid public Google Sheet.");
      return;
    }

    if (!silent) {
      setLoading(true);
      setSyncMessage('syncing', 'Syncing data...');
    } else {
      setIsBackgroundSyncing(true);
    }

    try {
      const { data: rawData, headers: sheetHeaders } = await fetchSheetData(config.url, config.sheetName);
      await processSheetData(rawData, sheetHeaders, silent);
    } catch (err: any) {
      const isNetworkError = err.message === 'Failed to fetch' ||
                             err.message.includes('timed out') ||
                             !navigator.onLine;

      if (!silent) {
        const userMessage = isNetworkError
          ? "NETWORK ERROR: Unable to reach Google Sheets. Please check your connection."
          : err.message;
        setError(userMessage);
        setSyncMessage('error', 'Sync failed, showing last data');
      } else {
        if (!isNetworkError) {
          console.error("Background sync failed:", err.message);
        } else {
          console.warn("Background sync skipped: Connection issue or timeout.");
        }
      }
    } finally {
      if (!silent) setLoading(false);
      else setIsBackgroundSyncing(false);
    }
  }, [config.url, config.sheetName, config.dataSource, config.dbAuthToken, processSheetData, loading, isBackgroundSyncing, preloadOtherSheet]);

  const lastDateMapping = useRef(config.mapping?.date);
  const lastInventoryDateMapping = useRef(config.mapping?.inventoryDate);
  const lastInventoryBatchMapping = useRef(config.mapping?.inventoryBatch);
  const lastCsDateMapping = useRef(config.mapping?.csDate);
  const lastCsBatchMapping = useRef(config.mapping?.csBatch);

  useEffect(() => {
    if (data.length > 0 && config.mapping && (
      lastDateMapping.current !== config.mapping.date || 
      lastInventoryDateMapping.current !== config.mapping.inventoryDate ||
      lastInventoryBatchMapping.current !== config.mapping.inventoryBatch ||
      lastCsDateMapping.current !== config.mapping.csDate ||
      lastCsBatchMapping.current !== config.mapping.csBatch
    )) {
      lastDateMapping.current = config.mapping.date;
      lastInventoryDateMapping.current = config.mapping.inventoryDate;
      lastInventoryBatchMapping.current = config.mapping.inventoryBatch;
      lastCsDateMapping.current = config.mapping.csDate;
      lastCsBatchMapping.current = config.mapping.csBatch;
      setData(prev => prev.map(row => {
        const parsedDate = parseDate(String(row[config.mapping.date] || ''));
        const parsedInventoryDate = parseDate(String(row[config.mapping.inventoryDate] || ''));
        const parsedCsDate = parseDate(String(row[config.mapping.csDate] || ''));
        return {
          ...row,
          date: parsedDate,
          _parsedDate: parsedDate,
          _inventoryDate: parsedInventoryDate,
          _csDate: parsedCsDate
        };
      }));
    }
  }, [config.mapping?.date, config.mapping?.inventoryDate, config.mapping?.inventoryBatch, config.mapping?.csDate, config.mapping?.csBatch, data.length]);

  const lastSyncAttempt = useRef<number>(Date.now());

  const prevConfigRef = useRef({ url: config.url, sheetName: config.sheetName });

  const prevTokenRef = useRef<string | undefined>(config.dbAuthToken);

  useEffect(() => { 
    if (config.url || config.dataSource === 'database') {
      const isConfigChange = prevConfigRef.current.url !== config.url || prevConfigRef.current.sheetName !== config.sheetName;
      const isTokenChange = prevTokenRef.current !== config.dbAuthToken;
      prevConfigRef.current = { url: config.url, sheetName: config.sheetName };
      prevTokenRef.current = config.dbAuthToken;

      if (data.length > 0 && !isConfigChange && !isTokenChange) {
        loadData(true);
      } else if (isConfigChange && sheetCacheRef.current[config.sheetName]) {
        loadData(true);
      } else {
        loadData(false);
      }
    }
  }, [config.url, config.sheetName, config.dataSource, config.dbAuthToken]);

  // Handle visibility change: Resume instantly and sync if needed
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became active again - check if we should sync
        const now = Date.now();
        // Only sync if it's been more than 5 minutes since last attempt
        if ((config.url || config.dataSource === 'database') && !loading && (now - lastSyncAttempt.current > 5 * 60 * 1000)) {
          lastSyncAttempt.current = now;
          loadData(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [config.url, config.sheetName, config.dataSource, loadData, loading, syncLatestData]);

  // Auto-sync every 3 seconds, ONLY when tab is active and online
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && (config.url || config.dataSource === 'database') && !loading && !isBackgroundSyncing && navigator.onLine) {
        lastSyncAttempt.current = Date.now();
        loadData(true);
      }
    }, 3 * 1000);
    return () => clearInterval(interval);
  }, [config.url, config.sheetName, config.dataSource, loadData, loading, isBackgroundSyncing]);

  // Keyboard shortcut: S to toggle between RT CONVERSION and WABI SABI
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        const next = config.sheetName === 'RT CONVERSION' ? 'WABI SABI' : 'RT CONVERSION';
        handleSheetSwitch(next);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.sheetName, handleSheetSwitch]);

  const allUniqueBatches = useMemo(() => {
    const batchCol = config.mapping?.batchNo;
    if (!batchCol || !headers.includes(batchCol)) {
      console.log('App: Batch column not found in headers:', batchCol, headers);
      return [];
    }
    const unique = Array.from(new Set(data.map(r => String(r[batchCol] || '').trim())))
      .filter(Boolean)
      .sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
    console.log('App: Found unique batches:', unique.length);
    return unique;
  }, [data, config.mapping?.batchNo, headers]);

  const filteredData = useMemo(() => {
    const mapping = config.mapping || DEFAULT_MAPPING;
    if (data.length === 0) return [];

    const parsedStartDate = dateRange.start ? new Date(dateRange.start) : null;
    if (parsedStartDate) parsedStartDate.setHours(0, 0, 0, 0);
    
    const parsedEndDate = dateRange.end ? new Date(dateRange.end) : null;
    if (parsedEndDate) parsedEndDate.setHours(0, 0, 0, 0);

    const batchCol = mapping.batchNo;
    const hasBatchFilter = batchCol && headers.includes(batchCol) && selectedBatches.length > 0 && selectedBatches.length < allUniqueBatches.length;
    const searchTerm = String(debouncedUidSearch || '').trim().toLowerCase();
    const uidCol = mapping.uid;

    const dateCol = mapping.date;
    const hasDateMapping = dateCol && headers.includes(dateCol);

    return data.filter(item => {
      // Date Filter
      if (hasDateMapping && (parsedStartDate || parsedEndDate)) {
        const rawRowDate = item.date;
        const rowDate = rawRowDate instanceof Date ? rawRowDate : (rawRowDate ? new Date(rawRowDate) : null);
        
        // If a row has a blank or invalid date, exclude it when a filter is active
        if (!rowDate || isNaN(rowDate.getTime())) return false;
        
        // Ensure rowDate is also forced to local midnight for comparison if not already
        // (Though parseDate should have already handled this)
        const rowTime = new Date(rowDate.getTime());
        rowTime.setHours(0, 0, 0, 0);

        const isAfterStart = !parsedStartDate || rowTime.getTime() >= parsedStartDate.getTime();
        const isBeforeEnd = !parsedEndDate || rowTime.getTime() <= parsedEndDate.getTime();

        if (!isAfterStart || !isBeforeEnd) return false;
      }
      
      // Batch Filter
      if (hasBatchFilter) {
        const rowBatch = String(item[batchCol] || '').trim();
        if (!selectedBatches.includes(rowBatch)) return false;
      }

      // UID Search Filter
      const uidString = String(item.uid || item.UID || item.Id || item[uidCol] || '');
      const matchesSearch = !searchTerm || uidString.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;

      return true;
    });
  }, [data, config, dateRange, selectedBatches, debouncedUidSearch, headers, allUniqueBatches]);

  const stats: KPIStats = useMemo(() => {
    const mapping = config.mapping || DEFAULT_MAPPING;
    let total = 0;
    let accepted = 0;
    let rejected = 0;
    let inwardCount = 0;
    let movedToInventory = 0;

    const getRowValue = (row: DashboardRow, column: string) => {
      if (!column) return 1;
      const val = row[column];
      if (val === undefined || val === null || val === '') return 1;
      const num = Number(val);
      return isNaN(num) ? 1 : num;
    };

    filteredData.forEach(r => {
      const uid = String(r[mapping.uid] || '').trim();
      const sku = String(r[mapping.sku] || '').trim();
      const qty = getRowValue(r, mapping.quantity);
      
      // Only count rows that have either a UID or an SKU
      if (uid !== '' || sku !== '') {
        total += qty;
        const status = String(r[mapping.ringStatus] || '').trim().toLowerCase();
        if (['accepted', 'ok', 'pass', '1', 'true', 'yes'].includes(status)) {
          accepted += qty;
        } else if (['rejected', 'nok', 'fail', '0', 'false', 'no'].includes(status)) {
          rejected += qty;
        }
      }

      if (String(r[mapping.inward] || '').trim() !== '') {
        inwardCount += qty;
      }
    });

    // Calculate movedToInventory separately using Inventory Date filtering
    const parsedStartDate = dateRange.start ? new Date(dateRange.start) : null;
    if (parsedStartDate) parsedStartDate.setHours(0, 0, 0, 0);
    
    const parsedEndDate = dateRange.end ? new Date(dateRange.end) : null;
    if (parsedEndDate) parsedEndDate.setHours(0, 0, 0, 0);

    const batchCol = mapping.batchNo;
    const inventoryBatchCol = mapping.inventoryBatch;
    const hasBatchFilter = batchCol && headers.includes(batchCol) && selectedBatches.length > 0 && selectedBatches.length < allUniqueBatches.length;
    const hasInventoryBatchFilter = inventoryBatchCol && headers.includes(inventoryBatchCol) && selectedBatches.length > 0 && selectedBatches.length < allUniqueBatches.length;
    const searchTerm = String(debouncedUidSearch || '').trim().toLowerCase();
    const uidCol = mapping.uid;

    data.forEach(r => {
      const movedVal = String(r[mapping.movedToInventory] || '').trim();
      if (movedVal === '') return;

      // Apply Inventory Date Filter
      const rowInventoryDate = r._inventoryDate instanceof Date ? r._inventoryDate : (r._inventoryDate ? new Date(r._inventoryDate) : null);
      
      if (parsedStartDate || parsedEndDate) {
        if (!rowInventoryDate || isNaN(rowInventoryDate.getTime())) return;
        
        const rowTime = new Date(rowInventoryDate.getTime());
        rowTime.setHours(0, 0, 0, 0);

        const isAfterStart = !parsedStartDate || rowTime.getTime() >= parsedStartDate.getTime();
        const isBeforeEnd = !parsedEndDate || rowTime.getTime() <= parsedEndDate.getTime();

        if (!isAfterStart || !isBeforeEnd) return;
      }

      // Apply Inventory Batch Filter
      if (hasInventoryBatchFilter) {
        const rowBatch = String(r[inventoryBatchCol] || '').trim();
        if (!selectedBatches.includes(rowBatch)) return;
      }

      // Apply UID Search Filter
      const uidString = String(r.uid || r.UID || r.Id || r[uidCol] || '');
      const matchesSearch = !searchTerm || uidString.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return;

      const qty = getRowValue(r, mapping.quantity);
      movedToInventory += qty;
    });

    // Calculate csRejection separately using CS Date/CS Batch filtering
    let csRejection = 0;

    data.forEach(r => {
      const csVal = String(r[mapping.csRejection] || '').trim();
      if (csVal === '') return;

      // Apply CS Date Filter
      const rowCsDate = r._csDate instanceof Date ? r._csDate : (r._csDate ? new Date(r._csDate) : null);

      if (parsedStartDate || parsedEndDate) {
        if (!rowCsDate || isNaN(rowCsDate.getTime())) return;
        
        const rowTime = new Date(rowCsDate.getTime());
        rowTime.setHours(0, 0, 0, 0);

        const isAfterStart = !parsedStartDate || rowTime.getTime() >= parsedStartDate.getTime();
        const isBeforeEnd = !parsedEndDate || rowTime.getTime() <= parsedEndDate.getTime();

        if (!isAfterStart || !isBeforeEnd) return;
      }

      // Apply CS Batch Filter
      const csBatchCol = mapping.csBatch;
      const hasCsBatchFilter = csBatchCol && headers.includes(csBatchCol) && selectedBatches.length > 0 && selectedBatches.length < allUniqueBatches.length;
      if (hasCsBatchFilter) {
        const rowBatch = String(r[csBatchCol] || '').trim();
        if (!selectedBatches.includes(rowBatch)) return;
      }

      // Apply UID Search Filter
      const uidString = String(r.uid || r.UID || r.Id || r[uidCol] || '');
      const matchesSearch = !searchTerm || uidString.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return;

      const qty = getRowValue(r, mapping.quantity);
      csRejection += qty;
    });

    const yieldVal = total > 0 ? (accepted / total) * 100 : 0;

    let wip: number;
    let wipSerials: string[];

    // Compute WIP serials for all sheets (set-based)
    {
      const inwardSet = new Set<string>();
      const completedSet = new Set<string>();

      data.forEach(r => {
        const inv = String(r[mapping.inward] || '').trim();
        if (inv) inwardSet.add(inv);

        const uid = String(r[mapping.uid] || '').trim();
        const status = String(r[mapping.ringStatus] || '').trim().toLowerCase();
        if (['rejected', 'nok', 'fail', '0', 'false', 'no'].includes(status) && uid) {
          completedSet.add(uid);
        }

        const movedVal = String(r[mapping.movedToInventory] || '').trim();
        if (movedVal) completedSet.add(movedVal);

        const csVal = String(r[mapping.csRejection] || '').trim();
        if (csVal) completedSet.add(csVal);
      });

      wipSerials = [...inwardSet].filter(s => !completedSet.has(s));
    }

    if (config.sheetName === 'RT CONVERSION') {
      wip = wipSerials.length;
    } else {
      // Quantity-based WIP for other sheets (e.g. WABI SABI)
      wip = Math.max(0, inwardCount - total);
    }
    
    return { total, accepted, rejected, wip, yield: yieldVal, movedToInventory, csRejection, wipSerials };
  }, [filteredData, config, data, dateRange, selectedBatches, debouncedUidSearch, headers, allUniqueBatches]);

  const movedRows = useMemo(() => {
    const mapping = config.mapping || DEFAULT_MAPPING;
    const parsedStartDate = dateRange.start ? new Date(dateRange.start) : null;
    if (parsedStartDate) parsedStartDate.setHours(0, 0, 0, 0);
    const parsedEndDate = dateRange.end ? new Date(dateRange.end) : null;
    if (parsedEndDate) parsedEndDate.setHours(0, 0, 0, 0);
    const inventoryBatchCol = mapping.inventoryBatch;
    const hasInventoryBatchFilter = inventoryBatchCol && headers.includes(inventoryBatchCol) && selectedBatches.length > 0 && selectedBatches.length < allUniqueBatches.length;
    const searchTerm = String(debouncedUidSearch || '').trim().toLowerCase();
    const uidCol = mapping.uid;

    return data.filter(r => {
      const movedVal = String(r[mapping.movedToInventory] || '').trim();
      if (movedVal === '') return false;

      if (parsedStartDate || parsedEndDate) {
        const rowInventoryDate = r._inventoryDate instanceof Date ? r._inventoryDate : (r._inventoryDate ? new Date(r._inventoryDate) : null);
        if (!rowInventoryDate || isNaN(rowInventoryDate.getTime())) return false;
        const rowTime = new Date(rowInventoryDate.getTime());
        rowTime.setHours(0, 0, 0, 0);
        const isAfterStart = !parsedStartDate || rowTime.getTime() >= parsedStartDate.getTime();
        const isBeforeEnd = !parsedEndDate || rowTime.getTime() <= parsedEndDate.getTime();
        if (!isAfterStart || !isBeforeEnd) return false;
      }

      if (hasInventoryBatchFilter) {
        const rowBatch = String(r[inventoryBatchCol] || '').trim();
        if (!selectedBatches.includes(rowBatch)) return false;
      }

      const uidString = String(r.uid || r.UID || r.Id || r[uidCol] || '');
      const matchesSearch = !searchTerm || uidString.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;

      return true;
    });
  }, [data, config.mapping, dateRange, selectedBatches, allUniqueBatches, headers, debouncedUidSearch]);

  const csRows = useMemo(() => {
    const mapping = config.mapping || DEFAULT_MAPPING;
    const parsedStartDate = dateRange.start ? new Date(dateRange.start) : null;
    if (parsedStartDate) parsedStartDate.setHours(0, 0, 0, 0);
    const parsedEndDate = dateRange.end ? new Date(dateRange.end) : null;
    if (parsedEndDate) parsedEndDate.setHours(0, 0, 0, 0);
    const csBatchCol = mapping.csBatch;
    const hasCsBatchFilter = csBatchCol && headers.includes(csBatchCol) && selectedBatches.length > 0 && selectedBatches.length < allUniqueBatches.length;
    const searchTerm = String(debouncedUidSearch || '').trim().toLowerCase();
    const uidCol = mapping.uid;

    return data.filter(r => {
      const csVal = String(r[mapping.csRejection] || '').trim();
      if (csVal === '') return false;

      if (parsedStartDate || parsedEndDate) {
        const rowCsDate = r._csDate instanceof Date ? r._csDate : (r._csDate ? new Date(r._csDate) : null);
        if (!rowCsDate || isNaN(rowCsDate.getTime())) return false;
        const rowTime = new Date(rowCsDate.getTime());
        rowTime.setHours(0, 0, 0, 0);
        const isAfterStart = !parsedStartDate || rowTime.getTime() >= parsedStartDate.getTime();
        const isBeforeEnd = !parsedEndDate || rowTime.getTime() <= parsedEndDate.getTime();
        if (!isAfterStart || !isBeforeEnd) return false;
      }

      if (hasCsBatchFilter) {
        const rowBatch = String(r[csBatchCol] || '').trim();
        if (!selectedBatches.includes(rowBatch)) return false;
      }

      const uidString = String(r.uid || r.UID || r.Id || r[uidCol] || '');
      const matchesSearch = !searchTerm || uidString.toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;

      return true;
    });
  }, [data, config.mapping, dateRange, selectedBatches, allUniqueBatches, headers, debouncedUidSearch]);

  const filteredWipSerials = useMemo(() => {
    const mapping = config.mapping || DEFAULT_MAPPING;
    const inwardSet = new Set<string>();
    filteredData.forEach(r => {
      const inward = String(r[mapping.inward] || '').trim();
      if (inward) inwardSet.add(inward);
    });
    return stats.wipSerials.filter(s => inwardSet.has(s));
  }, [filteredData, stats.wipSerials, config.mapping]);

  const skuDetails = useMemo(() => {
    const mapping = config.mapping || DEFAULT_MAPPING;
    const skuMap: Record<string, { total: number; accepted: number; rejected: number }> = {};
    
    let skuKey = mapping.sku;
    if (!headers.includes(skuKey)) {
      skuKey = findHeaderMatch(headers, ['sku', 'item', 'part', 'model']) || (headers.length > 0 ? headers[0] : '');
    }

    if (filteredData.length === 0 || !skuKey) {
      return [];
    }

    const getRowValue = (row: DashboardRow, column: string) => {
      if (!column) return 1;
      const val = row[column];
      if (val === undefined || val === null || val === '') return 1;
      const num = Number(val);
      return isNaN(num) ? 1 : num;
    };

    filteredData.forEach(r => {
      const val = r[skuKey];
      if (val !== undefined && val !== null) {
        const sku = String(val).trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); 
        if (sku !== '') {
          if (!skuMap[sku]) {
            skuMap[sku] = { total: 0, accepted: 0, rejected: 0 };
          }
          const qty = getRowValue(r, mapping.quantity);
          skuMap[sku].total += qty;
          
          const status = String(r[mapping.ringStatus] || '').trim().toLowerCase();
          if (['accepted', 'ok', 'pass', '1', 'true', 'yes'].includes(status)) {
            skuMap[sku].accepted += qty;
          } else if (['rejected', 'nok', 'fail', '0', 'false', 'no'].includes(status)) {
            skuMap[sku].rejected += qty;
          }
        }
      }
    });

    return Object.entries(skuMap).map(([sku, s]) => ({
      sku,
      total: s.total,
      accepted: s.accepted,
      rejected: s.rejected,
      yield: s.total > 0 ? (s.accepted / s.total) * 100 : 0
    }));
  }, [filteredData, config, headers, findHeaderMatch]);

  const handleCopyReport = () => {
    syncLatestData();
    if (stats.total === 0) {
      alert("No data available");
      return;
    }

    const mapping = config.mapping || DEFAULT_MAPPING;
    
    const totalData = filteredData.filter(r => 
      String(r[mapping.uid] || '').trim() !== '' || 
      String(r[mapping.sku] || '').trim() !== ''
    );

    const acceptedRows = totalData.filter(r => {
      const status = String(r[mapping.ringStatus] || '').trim().toLowerCase();
      return ['accepted', 'ok', 'pass', '1', 'true', 'yes'].includes(status);
    });
    
    const acceptedGroups: Record<string, number> = {};
    acceptedRows.forEach(r => {
      const sku = String(r[mapping.sku] || 'Unknown SKU').trim();
      acceptedGroups[sku] = (acceptedGroups[sku] || 0) + 1;
    });
    
    const acceptedDetailsStr = Object.entries(acceptedGroups)
      .map(([sku, count]) => `${sku}: ${count}`)
      .join('\n');

    const rejectedRows = totalData.filter(r => {
      const status = String(r[mapping.ringStatus] || '').trim().toLowerCase();
      return ['rejected', 'nok', 'fail', '0', 'false', 'no'].includes(status);
    });
    
    const rejectedGroups: Record<string, number> = {};
    rejectedRows.forEach(r => {
      const reason = String(r[mapping.reason] || 'No Reason Specified').trim();
      rejectedGroups[reason] = (rejectedGroups[reason] || 0) + 1;
    });
    
    const rejectedDetailsStr = Object.entries(rejectedGroups)
      .map(([reason, count]) => `${reason}: ${count}`)
      .join('\n');

    const reportText = `------------------------------------
BATCH REPORT

TOTAL : ${stats.total}
ACCEPTED : ${stats.accepted}
REJECTED : ${stats.rejected}
YIELD : ${stats.yield.toFixed(1)}%

ACCEPTED DETAILS
${acceptedDetailsStr || 'None'}

REJECTION DETAILS
${rejectedDetailsStr || 'None'}
------------------------------------`;

    navigator.clipboard.writeText(reportText).then(() => {
      setShowCopyToast(true);
      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current);
      copyToastTimeoutRef.current = setTimeout(() => setShowCopyToast(false), 3000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleOpenRejection = useCallback(() => setIsRejectionModalOpen(true), []);
  const handleCloseRejection = useCallback(() => setIsRejectionModalOpen(false), []);
  const handleOpenAccepted = useCallback(() => setIsAcceptedModalOpen(true), []);
  const handleCloseAccepted = useCallback(() => setIsAcceptedModalOpen(false), []);
  const handleOpenWip = useCallback(() => setIsWipModalOpen(true), []);
  const handleCloseWip = useCallback(() => setIsWipModalOpen(false), []);
  const handleOpenMoved = useCallback(() => setIsMovedModalOpen(true), []);
  const handleCloseMoved = useCallback(() => setIsMovedModalOpen(false), []);
  const handleOpenCs = useCallback(() => setIsCsModalOpen(true), []);
  const handleCloseCs = useCallback(() => setIsCsModalOpen(false), []);

  const handleAppAuth = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (appAuthPassword === '0369') {
      sessionStorage.setItem('qc_dashboard_authenticated', 'true');
      setIsAppAuthenticated(true);
      setShowAppAuth(false);
      setAppAuthPassword('');
      setAppAuthError(null);
    } else {
      setAppAuthError('Invalid password');
    }
  }, [appAuthPassword]);

  if (!isAppAuthenticated) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] bg-[#0f1117] flex items-center justify-center">
        <div className="relative bg-[#161a23] border border-white/5 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-[#38bdf8]/10 rounded-xl flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-[#38bdf8]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">Dashboard Access</h2>
              <p className="text-xs text-[#9ca3af] font-medium mt-1">Enter password to continue</p>
            </div>
          </div>

          <form onSubmit={handleAppAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#e5e7eb] mb-2">Password</label>
              <div className="relative">
                <input
                  type={showAppAuthPassword ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-12 bg-[#0f1117] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#38bdf8]/50 outline-none text-sm text-white placeholder:text-[#9ca3af]/50"
                  placeholder="Enter dashboard password"
                  value={appAuthPassword}
                  onChange={(e) => { setAppAuthPassword(e.target.value); setAppAuthError(null); }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowAppAuthPassword(!showAppAuthPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9ca3af] hover:text-white"
                >
                  {showAppAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {appAuthError && (
              <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#ef4444] shrink-0 mt-0.5" />
                <p className="text-sm text-[#ef4444] font-medium">{appAuthError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!appAuthPassword}
              className="w-full py-3.5 bg-[#38bdf8] hover:bg-[#0ea5e9] disabled:bg-[#38bdf8]/50 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
            >
              <KeyRound className="w-4 h-4" /> Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 w-full max-w-[100vw] bg-[#0f1117]">
        <header className="sticky top-0 z-40 bg-[#161a23]/90 backdrop-blur-xl border-b border-white/5 shadow-2xl w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center">
                <img 
                  src={`/logo.png?v=${Date.now()}`}
                  alt=""
                  style={{ maxHeight: '48px', width: 'auto', objectFit: 'contain' }}
                  className="rounded-xl"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-tight tracking-tight uppercase">Dashboard</h1>
                <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.4em] mono">Quality Analytics Pro</p>
              </div>
            </div>
              <div className="flex items-center gap-4">
                <div className="hidden lg:flex items-center bg-[#0f1117] border border-white/5 rounded-2xl p-1 gap-1">
                  <button
                    onClick={() => handleSheetSwitch('RT CONVERSION')}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                      config.sheetName === 'RT CONVERSION' 
                        ? 'bg-[#38bdf8] text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]' 
                        : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    RT CONVERSION
                  </button>
                  <button
                    onClick={() => handleSheetSwitch('WABI SABI')}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                      config.sheetName === 'WABI SABI' 
                        ? 'bg-[#38bdf8] text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]' 
                        : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    WABI SABI
                  </button>
                </div>

                {data.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsCompactMode(!isCompactMode)}
                      className={`hidden sm:flex items-center gap-2 px-4 py-2.5 text-[10px] font-black rounded-xl transition-all border uppercase tracking-widest ${
                        isCompactMode 
                          ? 'bg-[#38bdf8] text-white border-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.3)]' 
                          : 'bg-transparent text-[#9ca3af] border-white/10 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <Layout className="w-3.5 h-3.5" />
                      {isCompactMode ? 'Full View' : 'Compact Mode'}
                    </button>
                    <button 
                      onClick={handleCopyReport}
                      className="hidden sm:flex items-center gap-2 px-5 py-2.5 text-xs font-black text-[#e5e7eb] bg-[#22c55e]/10 hover:bg-[#22c55e]/20 rounded-xl transition-all border border-[#22c55e]/30 uppercase tracking-widest"
                    >
                      <Copy className="w-4 h-4 text-[#22c55e]" />
                      REPORT
                    </button>
                  </div>
                )}
                {(config.url || config.dataSource === 'database') && (
                  <div className="relative flex flex-col items-center">
                    <button 
                      onClick={() => {
                        if (latestDataRef.current) syncLatestData();
                        else loadData(false);
                      }} 
                      className="flex items-center gap-2 px-5 py-2.5 text-xs font-black text-[#38bdf8] hover:bg-[#38bdf8]/10 rounded-xl transition-all border border-[#38bdf8]/20 disabled:opacity-50 uppercase tracking-widest" 
                      disabled={loading || isBackgroundSyncing}
                    >
                      <RefreshCw className={`w-4 h-4 ${(loading || isBackgroundSyncing) ? 'animate-spin' : ''}`} />
                      <span className="hidden md:inline">
                        {(loading || isBackgroundSyncing) ? 'SYNCING...' : 'SYNC NOW'}
                      </span>
                    </button>
                    {(loading || isBackgroundSyncing) && (
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 animate-pulse whitespace-nowrap">
                        <RefreshCw className="w-2.5 h-2.5 text-[#38bdf8] animate-spin" />
                        <span className="text-[8px] font-black text-[#38bdf8] uppercase tracking-widest">
                          {loading ? 'Syncing' : 'Auto-Syncing'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <button onClick={requestSettingsOpen} className="p-3 bg-[#1e232d] text-[#e5e7eb] hover:bg-[#2a313d] rounded-2xl border border-white/5 transition-all shadow-xl">
                  <Menu className="w-6 h-6" />
                </button>
              </div>
          </div>
        </div>
        {/* Mobile Sheet Switcher */}
        <div className="lg:hidden px-4 pb-4 flex justify-center bg-[#161a23]/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center bg-[#0f1117] border border-white/10 rounded-2xl p-1 gap-1 w-full max-w-md shadow-inner">
            <button
              onClick={() => handleSheetSwitch('RT CONVERSION')}
              className={`flex-1 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                config.sheetName === 'RT CONVERSION' 
                  ? 'bg-[#38bdf8] text-white shadow-[0_0_20px_rgba(56,189,248,0.4)]' 
                  : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
              }`}
            >
              RT CONVERSION
            </button>
            <button
              onClick={() => handleSheetSwitch('WABI SABI')}
              className={`flex-1 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                config.sheetName === 'WABI SABI' 
                  ? 'bg-[#38bdf8] text-white shadow-[0_0_20px_rgba(56,189,248,0.4)]' 
                  : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
              }`}
            >
              WABI SABI
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 mt-10">
        {error && (
          <div className="mb-10 p-6 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-2xl flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-[#ef4444] shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-[#ef4444] uppercase tracking-widest">System Error</h4>
              <p className="text-sm text-[#9ca3af] mt-2 font-medium">{error}</p>
            </div>
          </div>
        )}

        {(!config.url && config.dataSource !== 'database' && !loading) ? (
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-[#161a23] rounded-3xl flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
              <Database className="w-10 h-10 text-[#38bdf8]" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">No Stream Detected</h2>
            <p className="text-[#9ca3af] max-sm mx-auto mb-6 text-sm leading-relaxed">
              Select a data source to initialize analytical rendering.
            </p>
            <button onClick={requestSettingsOpen} className="px-10 py-4 bg-[#38bdf8] hover:bg-[#0ea5e9] text-white font-bold rounded-2xl shadow-xl transition-all">
              OPEN CONFIG
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-700 space-y-10 w-full">
            {!isCompactMode && (
              <MemoizedFilterSection 
                batches={allUniqueBatches} 
                selectedBatches={selectedBatches} 
                setSelectedBatches={handleSetSelectedBatches} 
                dateRange={dateRange} 
                setDateRange={handleSetDateRange}
                uidSearch={uidSearch}
                setUidSearch={handleSetUidSearch}
                loading={loading}
              />
            )}
            <MemoizedKPIGrid 
              stats={stats} 
              loading={loading} 
              onRejectedClick={handleOpenRejection} 
              onAcceptedClick={handleOpenAccepted}
              onWipClick={handleOpenWip}
              onMovedClick={handleOpenMoved}
              onCsClick={handleOpenCs}
              filteredData={filteredData}
              mapping={config.mapping || DEFAULT_MAPPING}
            />
            
            {data.length > 0 && (
              <>
                {!isCompactMode && (
                    <div className="flex items-center justify-between px-6 py-4 bg-[#161a23] rounded-2xl border border-white/5">
                      <div className="flex items-center gap-6">
                        <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.2em] mono flex items-center gap-2">
                          {config.dataSource === 'database' ? (
                            <><Database className="w-3 h-3 text-[#38bdf8]" /> DB: <span className="text-[#38bdf8]">{config.sheetName}</span></>
                          ) : (
                            <>Source: <span className="text-[#38bdf8]">{config.sheetName}</span></>
                          )}
                        </p>
                        <p className="hidden md:flex items-center text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.2em] mono border-l border-white/10 pl-6 gap-2">
                          Last synced: <span className="text-white">{lastSyncTime.toLocaleTimeString()}</span>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                          </span>
                        </p>
                      </div>
                    <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.2em] mono">
                      Total Records: <span className="text-white bg-white/5 px-2 py-0.5 rounded ml-2">{filteredData.length}</span>
                    </p>
                  </div>
                )}
                
                {isCompactMode && (
                  <div style={{ contentVisibility: 'auto' }}>
                    <MemoizedSKUCountCharts data={filteredData} mapping={config.mapping || DEFAULT_MAPPING} />
                  </div>
                )}

                {!isCompactMode && (
                  <>
                    <div style={{ contentVisibility: 'auto' }}>
                      <MemoizedSKUDetailsSection skuDetails={skuDetails} />
                    </div>

                    <div className="pb-10 min-h-[500px]" style={{ contentVisibility: 'auto' }}>
                      <MemoizedRejectionDetailsSection 
                        filteredData={filteredData} 
                        mapping={config.mapping || DEFAULT_MAPPING} 
                        headers={headers} 
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {showCopyToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="px-8 py-4 bg-[#161a23] border border-[#22c55e]/30 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl">
            <Check className="w-5 h-5 text-[#22c55e]" />
            <span className="text-sm font-bold text-white uppercase tracking-widest">Report Copied to Clipboard</span>
          </div>
        </div>
      )}

      <MemoizedSettingsMenu config={{...config, mapping: config.mapping || DEFAULT_MAPPING}} headers={headers} onUpdate={handleConfigUpdate} isOpen={isSettingsOpen} setIsOpen={setIsSettingsOpen} isRefreshing={loading} onDbAuthRequest={() => setShowDbAuthModal(true)} />
      
      <MemoizedDatabaseAuthModal isOpen={showDbAuthModal} onClose={() => setShowDbAuthModal(false)} onAuthenticate={handleDbAuth} />

      <MemoizedRejectionDrilldownModal 
        isOpen={isRejectionModalOpen} 
        onClose={handleCloseRejection} 
        data={filteredData} 
        mapping={config.mapping || DEFAULT_MAPPING} 
      />

      <MemoizedAcceptedDrilldownModal 
        isOpen={isAcceptedModalOpen} 
        onClose={handleCloseAccepted} 
        data={filteredData} 
        mapping={config.mapping || DEFAULT_MAPPING} 
      />

      <MemoizedWipDrilldownModal 
        isOpen={isWipModalOpen}
        onClose={handleCloseWip}
        wipSerials={filteredWipSerials}
      />

      <MemoizedSerialListModal
        isOpen={isMovedModalOpen}
        onClose={handleCloseMoved}
        title="MOVED TO INVENTORY"
        data={movedRows}
        mapping={config.mapping || DEFAULT_MAPPING}
        accentColor="purple"
        totalLabel="Total Moved"
      />

      <MemoizedSerialListModal
        isOpen={isCsModalOpen}
        onClose={handleCloseCs}
        title="CS REJECTION"
        data={csRows}
        mapping={config.mapping || DEFAULT_MAPPING}
        accentColor="orange"
        totalLabel="Total CS Rejections"
        reasonField="csReason"
      />
    </div>
  );
};

export default App;
