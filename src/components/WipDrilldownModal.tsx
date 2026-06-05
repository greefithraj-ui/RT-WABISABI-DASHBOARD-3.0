import React, { useState, useMemo, memo } from 'react';
import { X, Search, Package, Hash, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface WipDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  wipSerials: string[];
}

const WipDrilldownModal: React.FC<WipDrilldownModalProps> = ({ isOpen, onClose, wipSerials }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSerials = useMemo(() => {
    if (!searchTerm) return wipSerials;
    return wipSerials.filter(s =>
      s.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [wipSerials, searchTerm]);

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
            <div className="p-3 bg-[#f59e0b]/10 rounded-2xl border border-[#f59e0b]/20">
              <AlertTriangle className="w-6 h-6 text-[#f59e0b]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">WIP Inventory Details</h2>
              <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.3em] mono">
                {wipSerials.length} Serial{wipSerials.length !== 1 ? 's' : ''} in Work In Progress
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] group-focus-within:text-[#f59e0b] transition-colors" />
              <input
                type="text"
                placeholder="Search serials..."
                className="pl-10 pr-4 py-2 bg-[#0f1117] border border-white/5 rounded-xl text-xs text-white focus:ring-2 focus:ring-[#f59e0b]/50 outline-none transition-all placeholder:text-[#9ca3af]/50 mono w-48"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-xl transition-colors text-[#9ca3af] hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="p-4 border-b border-white/5 bg-[#161a23] sm:hidden">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] group-focus-within:text-[#f59e0b] transition-colors" />
            <input
              type="text"
              placeholder="Search serials..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0f1117] border border-white/5 rounded-xl text-sm text-white focus:ring-2 focus:ring-[#f59e0b]/50 outline-none transition-all placeholder:text-[#9ca3af]/50 mono"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {wipSerials.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#10b981] bg-[#10b981]/5 rounded-3xl border border-[#10b981]/20">
              <Package className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-xs font-black uppercase tracking-[0.3em] text-center px-10">
                No WIP items — all INWARD serials have been completed.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0f1117]/30">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">#</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">INWARD Serial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSerials.length > 0 ? (
                    filteredSerials.map((serial, idx) => (
                      <tr
                        key={serial}
                        className="hover:bg-white/[0.03] transition-all group"
                      >
                        <td className="px-6 py-4 text-[10px] font-bold text-[#9ca3af] mono">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg text-[#f59e0b] group-hover:text-[#f59e0b] transition-colors">
                              <Hash className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-black text-white mono group-hover:text-[#f59e0b] transition-colors">
                              {serial}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-6 py-20 text-center text-[#9ca3af]/40 italic uppercase text-[10px] font-black tracking-[0.3em]">
                        No matching serials found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#1c212c] border-t border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-bold text-[#4b5563] uppercase tracking-widest mono">
              Total WIP: <span className="text-[#f59e0b]">{wipSerials.length}</span>
            </p>
            {filteredSerials.length !== wipSerials.length && (
              <p className="text-[10px] font-bold text-[#4b5563] uppercase tracking-widest mono border-l border-white/10 pl-4">
                Filtered: <span className="text-white">{filteredSerials.length}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black text-[#f59e0b] uppercase tracking-widest">
            <Package className="w-3 h-3" /> INWARD − (REJECTED ∪ MOVED ∪ CS)
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default memo(WipDrilldownModal);
