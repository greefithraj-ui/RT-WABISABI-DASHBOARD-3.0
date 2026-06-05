
import { ColumnMapping, SheetConfig } from './types';

export const DEFAULT_MAPPING: ColumnMapping = {
  uid: 'UID',
  ringStatus: 'RING STATUS',
  date: 'DATE',
  batchNo: 'BATCH NO',
  inward: 'INWARD',
  sku: 'SKU',
  reason: 'REASON',
  quantity: 'QTY',
  movedToInventory: 'MOVED TO INVENTORY',
  inventoryDate: 'Inventory Date',
  inventoryBatch: 'INVENTORY BATCH',
  csDate: 'CS DATE',
  csRejection: 'CS REJECTION UID',
  csBatch: 'CS BATCH',
  csReason: 'CS REJECTION'
};

export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1kId06QCUh6YhxeiX8QuPiimBr02ADwX8KPRp6FLxIcg/edit?gid=575402539#gid=575402539';

export const INITIAL_CONFIG: SheetConfig = {
  url: '',
  sheetName: 'RT CONVERSION',
  range: 'A1:Z1000',
  mapping: { ...DEFAULT_MAPPING },
  dataSource: 'sheet',
  dbAuthToken: undefined
};

export const COLORS = {
  metallicGreen: '#10b981',
  metallicRed: '#ef4444',
  slate400: '#94a3b8',
  slate800: '#1e293b'
};
