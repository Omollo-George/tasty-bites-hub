import React, { useEffect, useState } from 'react';
import { Zap, Users, MessageSquare, TrendingUp, Bell, ShieldCheck } from 'lucide-react';
import { getAdminToken } from '@/lib/admin-session';
import { getApiUrl } from '@/lib/api';

const AdminAutomation: React.FC = () => {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ query: string; answer: string }>>([]);

  const submitQuery = async () => {
    if (!query.trim()) return;
    setQueryLoading(true);
    setAnswer(null);
    const token = getAdminToken();

    try {
      const res = await fetch(getApiUrl('/payments/automation/query/'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim(), history }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to get answer');
      }
      const data = await res.json();
      const nextAnswer = data.answer || 'No answer returned.';
      setAnswer(nextAnswer);
      setHistory((current) => [...current, { query: query.trim(), answer: nextAnswer }]);
      setQuery('');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to answer query.';
      setAnswer(message);
      setHistory((current) => [...current, { query: query.trim(), answer: message }]);
    } finally {
      setQueryLoading(false);
    }
  };

  useEffect(() => {
    const fetchInsights = async () => {
      const token = getAdminToken();
      try {
        const res = await fetch(getApiUrl('/payments/automation/insights/'), {
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
      <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-2xl text-red-200">
        <h3 className="font-bold mb-2">Error Connecting to Engine</h3>
        <p className="text-sm opacity-80">{error}. Please ensure the backend is running and you are signed in.</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-slate-100">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900/60 border border-slate-700 p-6 rounded-3xl lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="text-emerald-300" />
            <div>
              <h3 className="font-bold">🤖 AI Report Assistant (Real-Time)</h3>
              <p className="text-xs text-slate-400">Powered by live restaurant data — conversational insights on demand</p>
            </div>
          </div>
          <div className="grid gap-3 mb-6">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask: e.g. 'Which stock items are low?', 'How much revenue did we make this week?', 'Who is the top waiter?'"
              className="min-h-[120px] w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuery('How is everything going?')}
                className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl"
              >
                💬 Status
              </button>
              <button
                type="button"
                onClick={() => setQuery('What is today\'s revenue?')}
                className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl"
              >
                💰 Today's Revenue
              </button>
              <button
                type="button"
                onClick={() => setQuery('Show me low stock items')}
                className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl"
              >
                ⚠️ Low Stock
              </button>
              <button
                type="button"
                onClick={() => setQuery('Who is the top performer?')}
                className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl"
              >
                🏆 Top Waiter
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submitQuery}
                disabled={queryLoading}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {queryLoading ? 'Thinking...' : 'Ask AI'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistory([]);
                  setAnswer(null);
                }}
                disabled={history.length === 0 && !answer}
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear chat
              </button>
            </div>
          </div>
          {insights?.automation_report ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 mb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-semibold">AI Automation Report</h4>
                  <p className="text-xs text-slate-400">Live metrics from the last 7 days</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">Live Data</span>
              </div>
              <p className="text-sm text-slate-200 mb-4">{insights.automation_report.summary}</p>
              <div className="grid gap-3 sm:grid-cols-3 mb-4">
                {insights.automation_report.key_metrics?.map((metric: any, index: number) => (
                  <div key={index} className="rounded-2xl bg-slate-900/70 p-3 text-xs">
                    <p className="text-slate-400">{metric.label}</p>
                    <p className="mt-2 font-semibold text-slate-100">{metric.value}</p>
                  </div>
                ))}
              </div>
              {insights.automation_report.top_items?.length > 0 ? (
                <div className="text-xs text-slate-300">
                  <div className="font-semibold text-slate-100 mb-2">Top Items</div>
                  <ul className="space-y-2">
                    {insights.automation_report.top_items.slice(0, 3).map((item: any, index: number) => (
                      <li key={index} className="flex items-center justify-between rounded-2xl bg-slate-900/60 px-3 py-2">
                        <span>{item.name}</span>
                        <span className="text-slate-300">{item.quantity} sold</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-5 min-h-[160px] max-h-[400px] overflow-y-auto">
            <p className="text-xs uppercase text-slate-500 mb-3">Live Conversation</p>
            <div className="space-y-3 text-sm">
              {history.length > 0 ? (
                history.map((entry, i) => (
                  <div key={i} className="space-y-2 animate-fadeIn">
                    <div className="rounded-2xl bg-slate-900/80 p-4 ml-auto max-w-xs">
                      <p className="text-[11px] uppercase text-slate-500 mb-1">You</p>
                      <p className="whitespace-pre-wrap text-slate-100">{entry.query}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/30 p-4 max-w-xs">
                      <p className="text-[11px] uppercase text-emerald-400 mb-1">🤖 Tasty Bites AI</p>
                      <p className="whitespace-pre-wrap text-slate-100">{entry.answer}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="whitespace-pre-wrap text-slate-100 text-center py-8">
                  👋 Start asking questions about your business! Try "How are you?", "What's today's revenue?", or "Show me low stock items"
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-700 p-6 rounded-3xl">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="text-yellow-300" />
            <div>
              <h3 className="font-bold">Inventory Alerts</h3>
              <p className="text-xs text-slate-400">Low stock items and actions to take.</p>
            </div>
          </div>
          <div className="space-y-3">
            {insights?.staffing_insights?.filter((s:any) => s.trigger?.startsWith('Low Stock')).length > 0 ? (
              insights.staffing_insights.filter((s:any) => s.trigger?.startsWith('Low Stock')).map((alert:any, i:number) => (
                <div key={i} className="bg-slate-800/60 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-[11px] text-yellow-300 uppercase font-bold tracking-wide">{alert.trigger}</p>
                  <p className="text-sm text-slate-200 mt-2">{alert.action}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic">No low stock alerts right now. Inventory levels are healthy.</p>
            )}
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