import React from 'react';
import { Link } from 'react-router-dom';

export default function AccountIndex(){
  return (
    <div className="min-h-screen p-8 bg-[linear-gradient(180deg,#060607_0%,#0b0b0c_100%)] text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-6">My Account</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link to="orders" className="group block p-5 rounded-xl backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:scale-[1.01] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Orders</div>
                <div className="text-sm text-slate-400">View your recent orders and tracking</div>
              </div>
              <div className="text-2xl opacity-80">📦</div>
            </div>
          </Link>

          <Link to="inbox" className="group block p-5 rounded-xl backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:scale-[1.01] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Inbox</div>
                <div className="text-sm text-slate-400">Messages and support conversations</div>
              </div>
              <div className="text-2xl opacity-80">✉️</div>
            </div>
          </Link>

          <Link to="reviews" className="group block p-5 rounded-xl backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:scale-[1.01] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Ratings & Reviews</div>
                <div className="text-sm text-slate-400">Manage your feedback and comments</div>
              </div>
              <div className="text-2xl opacity-80">⭐</div>
            </div>
          </Link>

          <Link to="vouchers" className="group block p-5 rounded-xl backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:scale-[1.01] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Vouchers</div>
                <div className="text-sm text-slate-400">Available discounts and promo codes</div>
              </div>
              <div className="text-2xl opacity-80">🎟️</div>
            </div>
          </Link>

          <Link to="wishlist" className="group block p-5 rounded-xl backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:scale-[1.01] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Wishlist</div>
                <div className="text-sm text-slate-400">Saved items you love</div>
              </div>
              <div className="text-2xl opacity-80">💙</div>
            </div>
          </Link>

          <Link to="following" className="group block p-5 rounded-xl backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:scale-[1.01] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Following</div>
                <div className="text-sm text-slate-400">Restaurants and chefs you follow</div>
              </div>
              <div className="text-2xl opacity-80">👨‍🍳</div>
            </div>
          </Link>

          <Link to="recent" className="group block p-5 rounded-xl backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:scale-[1.01] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Recently Viewed</div>
                <div className="text-sm text-slate-400">Quick access to recently viewed items</div>
              </div>
              <div className="text-2xl opacity-80">🕘</div>
            </div>
          </Link>

          <Link to="settings" className="group block p-5 rounded-xl backdrop-blur-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] hover:scale-[1.01] transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Settings</div>
                <div className="text-sm text-slate-400">Profile, security and preferences</div>
              </div>
              <div className="text-2xl opacity-80">⚙️</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
