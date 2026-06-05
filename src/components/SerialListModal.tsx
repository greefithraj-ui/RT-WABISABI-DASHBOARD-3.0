import React, { useState, useMemo, memo } from 'react';
import { X, Search, Filter, Hash, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { DashboardRow, ColumnMapping } from '../types';

interface SerialListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: DashboardRow[];
  mapping: ColumnMapping;
  accentColor?: string;
  totalLabel?: string;
  reasonField?: string;
}

const colorConfig: Record<string, { text: string; bg: string; border: string; ring: string; icon: string }> = {
  purple: { text: 'text-[#a855f7]', bg: 'bg-[#a855f7]/10', border: 'border-[#a855f7]/20', ring: 'ring-[#a855f7]/50', icon: '#a855f7' },
  orange: { text: 'text-[#f97316]', bg: 'bg-[#f97316]/10', border: 'border-[#f97316]/20', ring: 'ring-[#f97316]/50', icon: '#f97316' },
};

const SerialListModal: React.FC<SerialListModalProps> = ({ isOpen, onClose, title, data, mapping, accentColor = 'purple', totalLabel = 'Total', reasonField = 'reason' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');

  const colors = colorConfig[accentColor] || colorConfig.purple;
  const reasonCol = (mapping as any)[reasonField] || mapping.reason;

  const uniqueSkus = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => {
      const sku = String(r[mapping.sku] || '').trim();
      if (sku) set.add(sku);
    });
    return Array.from(set).sort();
  }, [data, mapping]);

  const uniqueReasons = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => {
      const reason = String(r[reasonCol] || '').trim();
      if (reason) set.add(reason);
    });
    return Array.from(set).sort();
  }, [data, reasonCol]);

  const filteredData = useMemo(() => {
    let result = data;
    if (skuFilter) {
      result = result.filter(r => String(r[mapping.sku] || '').trim() === skuFilter);
    }
    if (reasonFilter) {
      result = result.filter(r => String(r[reasonCol] || '').trim() === reasonFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => {
        const uid = String(r[mapping.uid] || '').toLowerCase();
        return uid.includes(term);
      });
    }
    return result;
  }, [data, searchTerm, skuFilter, reasonFilter, mapping, reasonCol]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#0f1117]/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-3xl bg-[#161a23] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1c212c]">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl border ${colors.bg} ${colors.border}`}>
              <Package className={`w-6 h-6 ${colors.text}`} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">{title}</h2>
              <p className={`text-[10px] font-bold uppercase tracking-[0.3em] mono ${colors.text}`}>
                Serial Number Details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-[#9ca3af] hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-white/5 bg-[#161a23]">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                type="text"
                placeholder="Search by UID..."
                className={`w-full pl-10 pr-4 py-2.5 bg-[#0f1117] border border-white/5 rounded-xl text-sm text-white focus:ring-2 outline-none transition-all placeholder:text-[#9ca3af]/50 mono ${colors.ring}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
              <select
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-[#0f1117] border border-white/5 rounded-xl text-sm text-white focus:ring-2 outline-none transition-all appearance-none mono cursor-pointer min-w-[160px]"
              >
                <option value="">All SKUs</option>
                {uniqueSkus.map(sku => (
                  <option key={sku} value={sku}>{sku}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-[#0f1117] border border-white/5 rounded-xl text-sm text-white focus:ring-2 outline-none transition-all appearance-none mono cursor-pointer min-w-[160px]"
              >
                <option value="">All Reasons</option>
                {uniqueReasons.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0f1117]/30">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-4 py-3 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">#</th>
                  <th className="px-4 py-3 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">UID</th>
                  <th className="px-4 py-3 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">SKU</th>
                  <th className="px-4 py-3 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">REASON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredData.length > 0 ? (
                  filteredData.map((r, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.03] transition-all">
                      <td className="px-4 py-3 text-[10px] font-bold text-[#9ca3af] mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-black text-white mono">{String(r[mapping.uid] || '').trim() || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-[#9ca3af] mono">{String(r[mapping.sku] || '').trim() || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-[#9ca3af]/80 mono">{String(r[reasonCol] || '').trim() || '-'}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-[#9ca3af]/40 italic uppercase text-[10px] font-black tracking-[0.3em]">
                      No matching serials found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#1c212c] border-t border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-bold text-[#4b5563] uppercase tracking-widest mono">
              {totalLabel}: <span className={colors.text}>{data.length}</span>
            </p>
            {filteredData.length !== data.length && (
              <p className="text-[10px] font-bold text-[#4b5563] uppercase tracking-widest mono border-l border-white/10 pl-4">
                Filtered: <span className="text-white">{filteredData.length}</span>
              </p>
            )}
          </div>
          <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${colors.text}`}>
            <Hash className="w-3 h-3" /> UID / SKU / Reason
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default memo(SerialListModal);
