import React from 'react';

export default function RecentlyViewed(){
  return (
    <div className="min-h-screen p-8 bg-[#0a0a0b] text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-4">Recently Viewed</h1>
        <p className="text-slate-400">You haven't viewed any items recently.</p>
      </div>
    </div>
  );
}
