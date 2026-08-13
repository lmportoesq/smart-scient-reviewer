'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

interface HumanReviewFormProps {
  paperId: string;
  onReviewCreated: () => void;
}

export function HumanReviewForm({ paperId, onReviewCreated }: HumanReviewFormProps) {
  const [decision, setDecision] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!decision) {
      setError('Please select a decision.');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await api.reviews.create(paperId, decision, reason.trim());
      setSuccess(true);
      onReviewCreated();
    } catch (err: any) {
      setError(err?.body?.message || 'Failed to save review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
        <svg className="w-10 h-10 text-green-500 mx-auto mb-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <p className="font-semibold text-green-800 dark:text-green-200">Human decision recorded</p>
        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
          Decision: {decision} — Reason: {reason}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Human Review</h3>

      {/* Decision buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Button
          variant={decision === 'APPROVE' ? 'primary' : 'secondary'}
          onClick={() => setDecision('APPROVE')}
          className={decision === 'APPROVE' ? 'ring-2 ring-green-500' : ''}
        >
          ✓ Approve
        </Button>
        <Button
          variant={decision === 'REJECT' ? 'danger' : 'secondary'}
          onClick={() => setDecision('REJECT')}
          className={decision === 'REJECT' ? 'ring-2 ring-red-500' : ''}
        >
          ✗ Reject
        </Button>
        <Button
          variant={decision === 'NEEDS_MORE_REVIEW' ? 'primary' : 'secondary'}
          onClick={() => setDecision('NEEDS_MORE_REVIEW')}
          className={decision === 'NEEDS_MORE_REVIEW' ? 'ring-2 ring-yellow-500' : ''}
        >
          ⟳ Needs More Review
        </Button>
      </div>

      {/* Reason */}
      <div className="mb-4">
        <label htmlFor="review-reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Decision reason (required)
        </label>
        <textarea
          id="review-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white"
          placeholder="Explain the basis for your decision..."
        />
        <p className="text-xs text-slate-400 mt-1">Minimum 10 characters</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <Button onClick={handleSubmit} loading={submitting} disabled={!decision}>
        Save Decision
      </Button>
    </div>
  );
}
