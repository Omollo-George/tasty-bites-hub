import React, { useEffect, useState } from 'react';
import { Zap, Users, MessageSquare, TrendingUp, Bell, ShieldCheck } from 'lucide-react';
import AdminHeader from './AdminHeader';
import { getAdminToken } from '@/lib/admin-session';

const AdminAutomation: React.FC = () => {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      const token = getAdminToken();
      try {
        const res = await fetch('/api/payments/automation/insights/', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!res.ok) throw new Error(res.status === 403 ? "Unauthorized Access" : "Failed to load insights");
        
        const data = await res.json();
        setInsights(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Connection Error");
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  if (loading) return (
    <div className="p-8 bg-slate-950 min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-slate-400">
        <Zap className="animate-bounce text-[#d69e2e]" size={48} />
        <p className="animate-pulse font-mono text-sm tracking-widest">INITIALIZING SUPER SYSTEM...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 bg-slate-950 min-h-screen">
      <AdminHeader title="Automation Hub" />
      <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-2xl text-red-200">
        <h3 className="font-bold mb-2">Error Connecting to Engine</h3>
        <p className="text-sm opacity-80">{error}. Please ensure the backend is running and you are signed in.</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-slate-100">
      <AdminHeader title="Automation Hub" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Re-engage Block */}
        <div className="bg-slate-900/50 border border-[#d69e2e]/20 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Users className="text-[#d69e2e]" />
            <h3 className="font-bold">Auto Re-engage</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">Targeting customers inactive for 30+ days.</p>
          <div className="space-y-3">
            {insights?.reengage_customers?.length > 0 ? (
              insights.reengage_customers.map((c: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm bg-slate-800/50 p-2 rounded-lg">
                  <span className="font-mono text-xs">{c.phone || "Guest"}</span>
                  <button className="text-[9px] bg-[#d69e2e] text-[#1a365d] px-2 py-1 rounded-full font-bold">SEND SMS</button>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-slate-500 italic">No inactive customers detected. Customer retention is high.</p>
            )}
          </div>
        </div>

        {/* Staffing Insights Block */}
        <div className="bg-slate-900/50 border border-blue-500/20 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-blue-400" />
            <h3 className="font-bold">Business Pulse</h3>
          </div>
          <div className="space-y-4">
            {insights?.staffing_insights?.length > 0 ? (
              insights.staffing_insights.map((s: any, i: number) => (
              <div key={i} className="border-l-2 border-blue-500 pl-3">
                <p className="text-[10px] text-blue-400 font-bold uppercase">{s.trigger}</p>
                <p className="text-sm font-semibold">{s.action}</p>
              </div>
              ))
            ) : (
              <p className="text-[10px] text-slate-500 italic">Analyzing traffic patterns... Sufficient data pending.</p>
            )}
          </div>
        </div>

        {/* Marketing Pulse Block */}
        <div className="bg-slate-900/50 border border-purple-500/20 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="text-purple-400" />
            <h3 className="font-bold">System Health</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm py-1 border-b border-slate-800">
              <span className="text-slate-400">Database Engine</span>
              <span className="text-emerald-400 font-bold text-xs">{insights?.system_health?.database}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-slate-800">
              <span className="text-slate-400">Automation Tasks</span>
              <span className="text-emerald-400 font-bold text-xs">Active</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-slate-400">Sync Interval</span>
              <span className="text-blue-400 font-bold text-xs">Real-time</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#1a365d] border border-[#d69e2e]/30 p-8 rounded-3xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
             <ShieldCheck className="text-[#d69e2e]" size={32} />
             <h2 className="text-2xl font-display text-[#d69e2e]">The Super System is Active</h2>
          </div>
          <p className="text-slate-300 max-w-2xl text-sm leading-relaxed">
            Tasty Bites Hub is monitoring live order volume and inventory burn rates. 
            Staffing projections and re-engagement flows are calculated every 60 minutes to ensure peak operational efficiency.
          </p>
        </div>
        <Zap className="absolute -right-10 -bottom-10 text-white/5 w-64 h-64" />
      </div>
    </div>
  );
};

export default AdminAutomation;