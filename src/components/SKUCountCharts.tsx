import React, { useMemo, memo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LabelList
} from 'recharts';
import { DashboardRow, ColumnMapping } from '../types';

interface SKUCountChartsProps {
  data: DashboardRow[];
  mapping: ColumnMapping;
}

const SKUCountCharts: React.FC<SKUCountChartsProps> = ({ data, mapping }) => {
  const getRowValue = (row: DashboardRow, column: string) => {
    if (!column) return 1;
    const val = row[column];
    if (val === undefined || val === null || val === '') return 1;
    const num = Number(val);
    return isNaN(num) ? 1 : num;
  };

  const chartData = useMemo(() => {
    const acceptedMap: Record<string, number> = {};
    const rejectedMap: Record<string, number> = {};
    
    const skuKey = mapping.sku;
    const statusKey = mapping.ringStatus;
    const qtyKey = mapping.quantity;

    data.forEach(row => {
      const sku = String(row[skuKey] || '').trim();
      if (!sku) return;

      const status = String(row[statusKey] || '').trim().toLowerCase();
      const qty = getRowValue(row, qtyKey);

      if (['accepted', 'ok', 'pass', '1', 'true', 'yes'].includes(status)) {
        acceptedMap[sku] = (acceptedMap[sku] || 0) + qty;
      } else if (['rejected', 'nok', 'fail', '0', 'false', 'no'].includes(status)) {
        rejectedMap[sku] = (rejectedMap[sku] || 0) + qty;
      }
    });

    const accepted = Object.entries(acceptedMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const rejected = Object.entries(rejectedMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return { accepted, rejected };
  }, [data, mapping]);

  const CustomTooltip = ({ active, payload, label, color }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#161a23] border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="text-[10px] font-black text-[#9ca3af] uppercase tracking-widest mb-1">{label}</p>
          <p className="text-sm font-black mono" style={{ color }}>
            {payload[0].value.toLocaleString()} UNITS
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
      {/* Accepted SKU Chart */}
      <div className="premium-card p-8 flex flex-col min-h-[450px]">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-1.5 h-6 bg-[#22c55e] rounded-full shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
          <h3 className="text-sm font-black text-[#e5e7eb] uppercase tracking-[0.2em] mono">
            Accepted SKU Count
          </h3>
        </div>
        
        <div className="flex-1 w-full">
          {chartData.accepted.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.accepted} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <defs>
                  <linearGradient id="acceptedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                    <stop offset="100%" stopColor="#166534" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip content={<CustomTooltip color="#22c55e" />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar 
                  dataKey="value" 
                  fill="url(#acceptedGradient)" 
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                >
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    style={{ fill: '#22c55e', fontSize: 10, fontWeight: '900', fontFamily: 'JetBrains Mono' }} 
                    formatter={(val: number) => val.toLocaleString()}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#9ca3af]/30">
              <p className="italic uppercase text-[10px] font-black tracking-[0.3em]">No accepted SKU data</p>
            </div>
          )}
        </div>
      </div>

      {/* Rejected SKU Chart */}
      <div className="premium-card p-8 flex flex-col min-h-[450px]">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-1.5 h-6 bg-[#ef4444] rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
          <h3 className="text-sm font-black text-[#e5e7eb] uppercase tracking-[0.2em] mono">
            Rejected SKU Count
          </h3>
        </div>
        
        <div className="flex-1 w-full">
          {chartData.rejected.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.rejected} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <defs>
                  <linearGradient id="rejectedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                    <stop offset="100%" stopColor="#991b1b" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip content={<CustomTooltip color="#ef4444" />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar 
                  dataKey="value" 
                  fill="url(#rejectedGradient)" 
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                >
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    style={{ fill: '#ef4444', fontSize: 10, fontWeight: '900', fontFamily: 'JetBrains Mono' }} 
                    formatter={(val: number) => val.toLocaleString()}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#9ca3af]/30">
              <p className="italic uppercase text-[10px] font-black tracking-[0.3em]">No rejected SKU data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(SKUCountCharts);
