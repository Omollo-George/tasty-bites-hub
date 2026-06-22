import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function Settings(){
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    marketing: true,
  });

  useEffect(()=>{
    const saved = localStorage.getItem('account.profile');
    if(saved) setProfile(JSON.parse(saved));
  },[]);

  const handleChange = (k: string, v: any) => setProfile(prev => ({...prev, [k]: v}));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('account.profile', JSON.stringify(profile));
    toast.success('Profile saved');
  };

  return (
    <div className="min-h-screen p-8 bg-[linear-gradient(180deg,#060607_0%,#0b0b0c_100%)] text-white">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

        {/* Left: Glass nav / profile summary */}
        <aside className="md:col-span-1 relative">
          <div className="backdrop-blur-md bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 shadow-[0_10px_30px_rgba(2,6,23,0.6)]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 via-pink-500 to-amber-400 flex items-center justify-center text-black font-bold transform transition-all hover:scale-105">{(profile.fullName||'U').slice(0,2).toUpperCase()}</div>
              <div>
                <h2 className="text-lg font-display font-semibold">Account</h2>
                <p className="text-sm text-slate-300">Manage your profile, security & preferences</p>
              </div>
            </div>

            <nav className="mt-6 space-y-2">
              <a className="flex items-center justify-between p-3 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition">
                <span className="text-sm">Profile</span>
                <span className="text-xs text-slate-400">Edit</span>
              </a>
              <a className="flex items-center justify-between p-3 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition">
                <span className="text-sm">Security</span>
                <span className="text-xs text-slate-400">Password & 2FA</span>
              </a>
              <a className="flex items-center justify-between p-3 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition">
                <span className="text-sm">Payment Methods</span>
                <span className="text-xs text-slate-400">Cards</span>
              </a>
              <a className="flex items-center justify-between p-3 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition">
                <span className="text-sm">Notifications</span>
                <span className="text-xs text-slate-400">Email & SMS</span>
              </a>
            </nav>

            <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.02)]">
              <div className="text-xs text-slate-400">Member since</div>
              <div className="text-sm mt-1">Jan 2024</div>
            </div>
          </div>
        </aside>

        {/* Right: Main form */}
        <main className="md:col-span-2">
          <div className="backdrop-blur-md bg-[linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8 shadow-[0_20px_60px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-display font-bold mb-1">Profile</h3>
                <p className="text-sm text-slate-300">Update your personal information and preferences.</p>
              </div>
              <div className="text-sm text-slate-400">Safe & secure</div>
            </div>

            <form onSubmit={handleSave} className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-sm text-slate-400 mb-2">Full name</div>
                  <input value={profile.fullName} onChange={e=>handleChange('fullName', e.target.value)} className="w-full p-3 rounded-lg bg-[rgba(2,6,23,0.6)] border border-[rgba(255,255,255,0.03)] placeholder:text-slate-500" placeholder="Your full name" />
                </label>
                <label className="block">
                  <div className="text-sm text-slate-400 mb-2">Email</div>
                  <input type="email" value={profile.email} onChange={e=>handleChange('email', e.target.value)} className="w-full p-3 rounded-lg bg-[rgba(2,6,23,0.6)] border border-[rgba(255,255,255,0.03)] placeholder:text-slate-500" placeholder="you@example.com" />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-sm text-slate-400 mb-2">Phone</div>
                  <input value={profile.phone} onChange={e=>handleChange('phone', e.target.value)} className="w-full p-3 rounded-lg bg-[rgba(2,6,23,0.6)] border border-[rgba(255,255,255,0.03)]" placeholder="+1 555 555 555" />
                </label>
                <label className="block md:col-span-1">
                  <div className="text-sm text-slate-400 mb-2">Address</div>
                  <input value={profile.address} onChange={e=>handleChange('address', e.target.value)} className="w-full p-3 rounded-lg bg-[rgba(2,6,23,0.6)] border border-[rgba(255,255,255,0.03)]" placeholder="Street, City, Country" />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input id="marketing" type="checkbox" checked={profile.marketing} onChange={e=>handleChange('marketing', e.target.checked)} className="w-4 h-4 accent-emerald-400" />
                <label htmlFor="marketing" className="text-sm text-slate-300">Receive marketing emails and offers</label>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <button type="submit" className="px-6 py-2 rounded-lg bg-emerald-400 text-black font-semibold shadow-sm">Save changes</button>
                <button type="button" onClick={()=>{ const saved = localStorage.getItem('account.profile'); if(saved){ setProfile(JSON.parse(saved)); toast('Reverted'); } else { setProfile({fullName:'',email:'',phone:'',address:'',marketing:true}); toast('Cleared'); }}} className="px-5 py-2 rounded-lg bg-[rgba(255,255,255,0.03)]">Cancel</button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
