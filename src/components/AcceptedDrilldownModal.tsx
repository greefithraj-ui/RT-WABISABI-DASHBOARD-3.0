import React, { useState, useMemo, memo } from 'react';
import { X, ChevronRight, ArrowLeft, CheckCircle, Calendar, Hash, Search, List, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardRow, ColumnMapping } from '../types';

interface AcceptedDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DashboardRow[];
  mapping: ColumnMapping;
}

const AcceptedDrilldownModal: React.FC<AcceptedDrilldownModalProps> = ({ isOpen, onClose, data, mapping }) => {
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [showSerials, setShowSerials] = useState(false);
  const [serialSearch, setSerialSearch] = useState('');
  const [serialSkuFilter, setSerialSkuFilter] = useState('');

  // Helper to format date string (DD-MM-YYYY or DD/MM/YYYY) to DD MMM YYYY
  const formatModalDate = (dateStr: string) => {
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      const day = parts[0];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const month = monthNames[monthIndex] || parts[1];
      const year = parts[2];
      return `${day} ${month} ${year}`;
    }
    return dateStr;
  };

  // Filter only accepted data
  const acceptedData = useMemo(() => {
    return data.filter(r => {
      const status = String(r[mapping.ringStatus] || '').trim().toLowerCase();
      return ['accepted', 'ok', 'pass', '1', 'true', 'yes'].includes(status);
    });
  }, [data, mapping]);

  // View 1: Group by SKU
  const skuGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    acceptedData.forEach(r => {
      const sku = String(r[mapping.sku] || 'Unknown SKU').trim();
      groups[sku] = (groups[sku] || 0) + 1;
    });

    return Object.entries(groups)
      .map(([sku, count]) => ({ sku, count }))
      .sort((a, b) => b.count - a.count);
  }, [acceptedData, mapping]);

  // View 2: Group by Date for selected SKU
  const dateGroups = useMemo(() => {
    if (!selectedSku) return [];

    const groups: Record<string, number> = {};
    acceptedData.filter(r => String(r[mapping.sku] || 'Unknown SKU').trim() === selectedSku)
      .forEach(r => {
        const dateStr = String(r[mapping.date] || 'Unknown Date').trim();
        const displayDate = formatModalDate(dateStr);
        groups[displayDate] = (groups[displayDate] || 0) + 1;
      });

    return Object.entries(groups)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => {
        // For sorting, we try to parse the formatted date back to a timestamp
        // or use a more robust parsing if needed. 
        // Since formatModalDate produces "DD MMM YYYY", new Date() should handle it well for sorting.
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return timeB - timeA;
      });
  }, [acceptedData, selectedSku, mapping, formatModalDate]);

  // View 3: All accepted serials with search and SKU filter
  const uniqueAcceptedSkus = useMemo(() => {
    const set = new Set<string>();
    acceptedData.forEach(r => {
      const sku = String(r[mapping.sku] || '').trim();
      if (sku) set.add(sku);
    });
    return Array.from(set).sort();
  }, [acceptedData, mapping]);

  const filteredSerials = useMemo(() => {
    let result = acceptedData;
    if (serialSkuFilter) {
      result = result.filter(r => String(r[mapping.sku] || '').trim() === serialSkuFilter);
    }
    if (serialSearch) {
      const term = serialSearch.toLowerCase();
      result = result.filter(r => {
        const uid = String(r[mapping.uid] || '').toLowerCase();
        return uid.includes(term);
      });
    }
    return result;
  }, [acceptedData, serialSearch, serialSkuFilter, mapping]);

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
        className="relative w-full max-w-2xl bg-[#161a23] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1c212c]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#22c55e]/10 rounded-2xl border border-[#22c55e]/20">
              <CheckCircle className="w-6 h-6 text-[#22c55e]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Accepted Drill-down</h2>
              <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.3em] mono">
                {showSerials ? 'All Accepted Serials' : selectedSku ? `SKU: ${selectedSku}` : 'Distribution by SKU'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showSerials && (
              <button 
                onClick={() => setShowSerials(true)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors text-[#9ca3af] hover:text-[#22c55e]"
                title="View Accepted Serials"
              >
                <List className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-[#9ca3af] hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {showSerials ? (
              <motion.div 
                key="serials-list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <button 
                  onClick={() => { setShowSerials(false); setSerialSearch(''); setSerialSkuFilter(''); }}
                  className="flex items-center gap-2 text-[#9ca3af] hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to SKU View
                </button>

                {/* Search and Filter */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                    <input
                      type="text"
                      placeholder="Search by UID..."
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0f1117] border border-white/5 rounded-xl text-sm text-white focus:ring-2 focus:ring-[#22c55e]/50 outline-none transition-all placeholder:text-[#9ca3af]/50 mono"
                      value={serialSearch}
                      onChange={(e) => setSerialSearch(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                    <select
                      value={serialSkuFilter}
                      onChange={(e) => setSerialSkuFilter(e.target.value)}
                      className="pl-10 pr-8 py-2.5 bg-[#0f1117] border border-white/5 rounded-xl text-sm text-white focus:ring-2 focus:ring-[#22c55e]/50 outline-none transition-all appearance-none mono cursor-pointer min-w-[160px]"
                    >
                      <option value="">All SKUs</option>
                      {uniqueAcceptedSkus.map(sku => (
                        <option key={sku} value={sku}>{sku}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Serials Table */}
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0f1117]/30">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5">
                        <th className="px-4 py-3 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">#</th>
                        <th className="px-4 py-3 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">UID</th>
                        <th className="px-4 py-3 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">SKU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredSerials.length > 0 ? (
                        filteredSerials.map((r, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.03] transition-all">
                            <td className="px-4 py-3 text-[10px] font-bold text-[#9ca3af] mono">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-black text-white mono">{String(r[mapping.uid] || '').trim() || '-'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold text-[#9ca3af] mono">{String(r[mapping.sku] || '').trim() || '-'}</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-16 text-center text-[#9ca3af]/40 italic uppercase text-[10px] font-black tracking-[0.3em]">
                            No matching serials found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : !selectedSku ? (
              <motion.div 
                key="sku-list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-3"
              >
                {skuGroups.length > 0 ? (
                  skuGroups.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSku(item.sku)}
                      className="w-full flex items-center justify-between p-4 bg-[#1e232d] hover:bg-[#2a313d] border border-white/5 rounded-2xl transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-[#9ca3af] group-hover:text-[#22c55e] transition-colors">
                          <Hash className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-white text-sm">{item.sku}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-0.5">Accepted</p>
                          <p className="text-lg font-black text-[#22c55e] mono">{item.count}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#4b5563] group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <p className="text-[#4b5563] font-bold uppercase tracking-widest text-sm">No accepted items found</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="date-list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <button 
                  onClick={() => setSelectedSku(null)}
                  className="flex items-center gap-2 text-[#9ca3af] hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to SKUs
                </button>

                <div className="grid grid-cols-1 gap-3">
                  {dateGroups.map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-4 bg-[#1e232d] border border-white/5 rounded-2xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-[#9ca3af]">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-white text-sm">{item.date}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-0.5">Count</p>
                        <p className="text-lg font-black text-[#22c55e] mono">{item.count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#1c212c] border-t border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-bold text-[#4b5563] uppercase tracking-widest mono">
              Total Accepted: <span className="text-[#22c55e]">{acceptedData.length}</span>
            </p>
            {showSerials && filteredSerials.length !== acceptedData.length && (
              <p className="text-[10px] font-bold text-[#4b5563] uppercase tracking-widest mono border-l border-white/10 pl-4">
                Filtered: <span className="text-white">{filteredSerials.length}</span>
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default memo(AcceptedDrilldownModal);
