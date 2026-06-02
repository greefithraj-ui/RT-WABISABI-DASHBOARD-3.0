
import React, { useState } from 'react';
import { Settings, X, RefreshCw, ChevronDown, Database, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import { SheetConfig, ColumnMapping } from '../types';

interface SettingsMenuProps {
  config: SheetConfig;
  headers: string[];
  onUpdate: (newConfig: SheetConfig) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isRefreshing: boolean;
  onDbAuthRequest?: () => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ 
  config, 
  headers, 
  onUpdate, 
  isOpen, 
  setIsOpen,
  isRefreshing,
  onDbAuthRequest
}) => {
  const [localConfig, setLocalConfig] = useState(config);

  const handleSave = () => {
    if (localConfig.dataSource === 'database' && !localConfig.dbAuthToken) {
      onUpdate(localConfig);
      setIsOpen(false);
      if (onDbAuthRequest) onDbAuthRequest();
      return;
    }
    onUpdate(localConfig);
    setIsOpen(false);
  };

  const handleMappingChange = (key: keyof ColumnMapping, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      mapping: { ...prev.mapping, [key]: value }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-[#0f1117]/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-[#161a23] border-l border-white/5 shadow-2xl flex flex-col">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1c212c]">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Settings className="w-5 h-5 text-[#38bdf8]" />
            Dashboard Settings
          </h2>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-[#9ca3af] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Data Source Selector */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-[#9ca3af] uppercase tracking-widest">Data Source</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLocalConfig(prev => ({ ...prev, dataSource: 'sheet', url: prev.url || '' }))}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  localConfig.dataSource === 'sheet'
                    ? 'bg-[#38bdf8]/10 border-[#38bdf8]/40 text-white'
                    : 'bg-[#0f1117] border-white/5 text-[#9ca3af] hover:border-white/20'
                }`}
              >
                <Globe className={`w-5 h-5 ${localConfig.dataSource === 'sheet' ? 'text-[#38bdf8]' : ''}`} />
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest">Google Sheet</p>
                  <p className="text-[9px] text-[#9ca3af] mt-0.5">Direct URL access</p>
                </div>
              </button>
              <button
                onClick={() => setLocalConfig(prev => ({ ...prev, dataSource: 'database' }))}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  localConfig.dataSource === 'database'
                    ? 'bg-[#38bdf8]/10 border-[#38bdf8]/40 text-white'
                    : 'bg-[#0f1117] border-white/5 text-[#9ca3af] hover:border-white/20'
                }`}
              >
                <Database className={`w-5 h-5 ${localConfig.dataSource === 'database' ? 'text-[#38bdf8]' : ''}`} />
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest">Database</p>
                  <p className="text-[9px] text-[#9ca3af] mt-0.5">Server with auth</p>
                </div>
              </button>
            </div>
          </section>

          {/* Source Settings */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-[#9ca3af] uppercase tracking-widest">
              {localConfig.dataSource === 'database' ? 'Database Connection' : 'Sheet Source'}
            </h3>

            {localConfig.dataSource === 'database' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-[#e5e7eb] mb-1">Google Sheet URL</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#38bdf8]/50 outline-none text-sm text-white placeholder:text-[#9ca3af]/50"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={localConfig.url}
                    onChange={e => setLocalConfig({...localConfig, url: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#e5e7eb] mb-1">Sheet Name</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#38bdf8]/50 outline-none text-sm text-white"
                    value={localConfig.sheetName}
                    onChange={e => setLocalConfig({...localConfig, sheetName: e.target.value})}
                  />
                </div>
                {localConfig.dbAuthToken ? (
                  <div className="p-3 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-[#22c55e]" />
                    <div>
                      <p className="text-sm font-bold text-[#22c55e] uppercase tracking-widest">Connected</p>
                      <p className="text-[10px] text-[#9ca3af] mt-0.5">Database authenticated</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-[#f59e0b]" />
                    <div>
                      <p className="text-sm font-bold text-[#f59e0b] uppercase tracking-widest">Not Connected</p>
                      <p className="text-[10px] text-[#9ca3af] mt-0.5">Password required to connect</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-[#e5e7eb] mb-1">Google Sheet URL</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#38bdf8]/50 outline-none text-sm text-white placeholder:text-[#9ca3af]/50"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={localConfig.url}
                    onChange={e => setLocalConfig({...localConfig, url: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-[#e5e7eb] mb-1">Sheet Name</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#38bdf8]/50 outline-none text-sm text-white"
                      value={localConfig.sheetName}
                      onChange={e => setLocalConfig({...localConfig, sheetName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#e5e7eb] mb-1">Range</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#38bdf8]/50 outline-none text-sm text-white"
                      value={localConfig.range}
                      onChange={e => setLocalConfig({...localConfig, range: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Column Mapping */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-[#9ca3af] uppercase tracking-widest">Column Mapping</h3>
              <span className="text-[10px] bg-[#38bdf8]/10 text-[#38bdf8] px-2 py-0.5 rounded-full border border-[#38bdf8]/20">Auto-detected</span>
            </div>
            <div className="space-y-3">
              {localConfig.mapping && (Object.keys(localConfig.mapping) as Array<keyof ColumnMapping>).map((key) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-[#e5e7eb] capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-xl appearance-none focus:ring-2 focus:ring-[#38bdf8]/50 outline-none text-sm pr-10 text-white"
                      value={localConfig.mapping[key]}
                      onChange={(e) => handleMappingChange(key, e.target.value)}
                    >
                      <option value="" className="bg-[#161a23] text-[#9ca3af]">-- Select Header --</option>
                      {headers.map(h => (
                        <option key={h} value={h} className="bg-[#161a23] text-white">{h}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-white/5 bg-[#1c212c] space-y-3">
          <button 
            onClick={handleSave}
            className="w-full py-3 bg-[#38bdf8] hover:bg-[#0ea5e9] text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest text-xs"
            disabled={isRefreshing}
          >
            {isRefreshing ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
