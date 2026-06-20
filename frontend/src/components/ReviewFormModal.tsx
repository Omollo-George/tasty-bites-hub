import React, { useState } from 'react';
import { X, Star, Loader2 } from 'lucide-react';
import { getApiUrl, apiFetch } from '@/lib/api';
import { toast } from 'sonner';

interface ReviewFormModalProps {
  onClose: () => void;
  onSubmitSuccess: () => void;
}

const ReviewFormModal: React.FC<ReviewFormModalProps> = ({ onClose, onSubmitSuccess }) => {
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a star rating.");
      return;
    }

    setLoading(true);
    try {
      try {
        await apiFetch('/payments/reviews/create/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: customerName.trim() || null,
            rating: rating,
            comment: comment.trim() || null,
          }),
        })
      } catch (err: any) {
        throw new Error(err?.body || err?.message || 'Failed to submit review.')
      }

      toast.success("Review Submitted!", { description: "Thank you for your feedback!" });
      onSubmitSuccess();
      onClose();
    } catch (error: any) {
      toast.error("Submission Failed", { description: error.message || "Could not submit your review." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-[#161617] text-white rounded-2xl shadow-2xl p-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors">
          <X size={24} />
        </button>

        <h2 className="text-3xl font-bold mb-4 text-orange-500">Leave a Review</h2>
        <p className="text-gray-400 mb-6">Share your experience with Tasty Bites Hub.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Your Rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={32}
                  className={`cursor-pointer transition-colors ${
                    (hoverRating || rating) >= star ? 'text-orange-500 fill-orange-500' : 'text-gray-600'
                  }`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-300 mb-2">Your Name (Optional)</label>
            <input
              type="text"
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm placeholder:text-gray-600"
              placeholder="e.g., John Doe"
            />
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-300 mb-2">Your Comments (Optional)</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm placeholder:text-gray-600 resize-none"
              placeholder="What did you think of our service?"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading || rating === 0}
            className="w-full py-4 rounded-2xl bg-orange-600 text-white font-black text-lg transition-all hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="animate-spin" size={20} /> Submitting...</>
            ) : (
              "Submit Review"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReviewFormModal;