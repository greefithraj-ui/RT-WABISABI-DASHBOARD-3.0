
import React, { useMemo, useEffect, useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Package, Info, ChevronRight, ArrowLeft, Hash, Search, List, Filter } from 'lucide-react';
import { DashboardRow, ColumnMapping } from '../types';

interface RejectionDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DashboardRow[];
  mapping: ColumnMapping;
}

const RejectionDrilldownModal: React.FC<RejectionDrilldownModalProps> = ({ 
  isOpen, 
  onClose, 
  data, 
  mapping 
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
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

  // Reset selected reason when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setSelectedReason(null), 300);
    }
  }, [isOpen]);

  // Base Filter: Isolate rejected items
  const rejectedRows = useMemo(() => {
    return data.filter(r => {
      const status = String(r[mapping.ringStatus] || '').trim().toLowerCase();
      return ['rejected', 'nok', 'fail', '0', 'false', 'no'].includes(status);
    });
  }, [data, mapping]);

  // View 1 Logic: Group by Rejection Reason
  const reasonGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    rejectedRows.forEach(r => {
      const reason = String(r[mapping.reason] || 'No Reason Specified').trim();
      groups[reason] = (groups[reason] || 0) + 1;
    });

    return Object.entries(groups)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [rejectedRows, mapping]);

  // View 2 Logic: Group by SKU for selected reason
  const skuGroups = useMemo(() => {
    if (!selectedReason) return [];

    const groups: Record<string, number> = {};
    rejectedRows
      .filter(r => String(r[mapping.reason] || 'No Reason Specified').trim() === selectedReason)
      .forEach(r => {
        const sku = String(r[mapping.sku] || 'Unknown SKU').trim();
        groups[sku] = (groups[sku] || 0) + 1;
      });

    return Object.entries(groups)
      .map(([sku, count]) => ({ sku, count }))
      .sort((a, b) => b.count - a.count);
  }, [rejectedRows, selectedReason, mapping]);

  // View 3: All rejected serials with search and SKU filter
  const uniqueRejectedSkus = useMemo(() => {
    const set = new Set<string>();
    rejectedRows.forEach(r => {
      const sku = String(r[mapping.sku] || '').trim();
      if (sku) set.add(sku);
    });
    return Array.from(set).sort();
  }, [rejectedRows, mapping]);

  const filteredSerials = useMemo(() => {
    let result = rejectedRows;
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
  }, [rejectedRows, serialSearch, serialSkuFilter, mapping]);

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0f1117]/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[80vh] bg-[#161a23] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#ef4444]/10 to-transparent">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#ef4444]/20 rounded-2xl border border-[#ef4444]/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <AlertTriangle className="w-6 h-6 text-[#ef4444]" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Rejection Drill-down</h2>
                  <p className="text-[10px] font-bold text-[#ef4444] uppercase tracking-[0.3em] mono">
                    {showSerials ? 'All Rejected Serials' : selectedReason ? `Reason: ${selectedReason}` : 'Analysis by Reason'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!showSerials && (
                  <button 
                    onClick={() => setShowSerials(true)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors text-[#9ca3af] hover:text-[#ef4444]"
                    title="View Rejected Serials"
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
                      Back to Reason View
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                        <input
                          type="text"
                          placeholder="Search by UID..."
                          className="w-full pl-10 pr-4 py-2.5 bg-[#0f1117] border border-white/5 rounded-xl text-sm text-white focus:ring-2 focus:ring-[#ef4444]/50 outline-none transition-all placeholder:text-[#9ca3af]/50 mono"
                          value={serialSearch}
                          onChange={(e) => setSerialSearch(e.target.value)}
                        />
                      </div>
                      <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                        <select
                          value={serialSkuFilter}
                          onChange={(e) => setSerialSkuFilter(e.target.value)}
                          className="pl-10 pr-8 py-2.5 bg-[#0f1117] border border-white/5 rounded-xl text-sm text-white focus:ring-2 focus:ring-[#ef4444]/50 outline-none transition-all appearance-none mono cursor-pointer min-w-[160px]"
                        >
                          <option value="">All SKUs</option>
                          {uniqueRejectedSkus.map(sku => (
                            <option key={sku} value={sku}>{sku}</option>
                          ))}
                        </select>
                      </div>
                    </div>

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
                ) : !selectedReason ? (
                  <motion.div
                    key="reason-view"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-3"
                  >
                    {reasonGroups.length === 0 ? (
                      <div className="py-20 text-center">
                        <Info className="w-12 h-12 text-[#9ca3af]/20 mx-auto mb-4" />
                        <p className="text-[#9ca3af] font-medium">No rejected records found in current selection.</p>
                      </div>
                    ) : (
                      reasonGroups.map((item, idx) => (
                        <button
                          key={item.reason}
                          onClick={() => setSelectedReason(item.reason)}
                          className="w-full group p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] hover:border-[#ef4444]/30 transition-all flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/5 rounded-lg group-hover:bg-[#ef4444]/10 transition-colors">
                              <AlertTriangle className="w-4 h-4 text-[#9ca3af] group-hover:text-[#ef4444]" />
                            </div>
                            <div>
                              <div className="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-1">Rejection Reason</div>
                              <div className="text-sm font-bold text-white">{item.reason}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-1">Count</div>
                              <div className="text-2xl font-black text-[#ef4444] tracking-tighter mono">
                                {item.count}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#4b5563] group-hover:text-white transition-colors" />
                          </div>
                        </button>
                      ))
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="sku-view"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <button 
                      onClick={() => setSelectedReason(null)}
                      className="flex items-center gap-2 text-[#9ca3af] hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-6 group"
                    >
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      Back to Reasons
                    </button>

                    <div className="grid grid-cols-1 gap-3">
                      {skuGroups.map((item, idx) => (
                        <div 
                          key={item.sku}
                          className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-[#9ca3af]">
                              <Hash className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-1">SKU ID</div>
                              <div className="text-sm font-bold text-white mono">{item.sku}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-0.5">Rejected</p>
                            <p className="text-lg font-black text-[#ef4444] mono">{item.count}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-6 bg-white/5 border-t border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mono">
                  Total Rejections: <span className="text-[#ef4444] ml-1">{rejectedRows.length}</span>
                </p>
                {showSerials && filteredSerials.length !== rejectedRows.length && (
                  <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mono border-l border-white/10 pl-4">
                    Filtered: <span className="text-white">{filteredSerials.length}</span>
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all"
              >
                Close View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default memo(RejectionDrilldownModal);
