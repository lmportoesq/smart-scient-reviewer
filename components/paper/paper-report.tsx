'use client';

import { useState } from 'react';
import { PriorityBadge, SeverityBadge, Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HumanReviewForm } from '@/components/review/human-review-form';

interface PaperReportProps {
  paper: any;
  onRefresh: () => void;
}

export function PaperReport({ paper, onRefresh }: PaperReportProps) {
  const [showEvidence, setShowEvidence] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Paper Info */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {paper.title || 'Untitled Paper'}
            </h2>
            <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              {paper.authors && (
                <p>Authors: {Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}</p>
              )}
              {paper.journal && <p>Journal: {paper.journal}</p>}
              {paper.publicationYear && <p>Year: {paper.publicationYear}</p>}
              {paper.doi && <p>DOI: {paper.doi}</p>}
            </div>
          </div>
          {paper.reviewPriority && (
            <PriorityBadge priority={paper.reviewPriority} />
          )}
        </div>
      </div>

      {/* Signals */}
      {paper.evidences?.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Signals</h3>
          <div className="space-y-3">
            {paper.evidences.map((evidence: any) => (
              <div
                key={evidence.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  <SignalIcon severity={evidence.severity} />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {evidence.title}
                    </p>
                    <p className="text-xs text-slate-500">Source: {evidence.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={evidence.severity} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEvidence(showEvidence === evidence.id ? null : evidence.id)}
                  >
                    {showEvidence === evidence.id ? 'Hide' : 'View Evidence'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Detail */}
      {showEvidence && (
        <EvidenceDetail
          evidence={paper.evidences.find((e: any) => e.id === showEvidence)}
        />
      )}

      {/* Claims */}
      {paper.claims?.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Claims <Badge variant="info">{paper.claims.length}</Badge>
          </h3>
          <div className="space-y-3">
            {paper.claims.map((claim: any) => (
              <div key={claim.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-slate-900 dark:text-white flex-1">{claim.claim}</p>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant={claim.supportLevel === 'SUPPORTED' ? 'success' : claim.supportLevel === 'UNSUPPORTED' ? 'danger' : 'warning'}>
                      {claim.supportLevel}
                    </Badge>
                    {claim.needsHumanReview && (
                      <Badge variant="warning">Needs Review</Badge>
                    )}
                  </div>
                </div>
                {claim.page && (
                  <p className="text-xs text-slate-500 mt-1">Page {claim.page}</p>
                )}
                {claim.confidence != null && (
                  <p className="text-xs text-slate-500">Confidence: {(claim.confidence * 100).toFixed(0)}%</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 italic">
            Claims are AI-interpreted and require human verification.
          </p>
        </div>
      )}

      {/* Human Review */}
      {paper.analysisStatus === 'COMPLETED' && (
        <HumanReviewForm paperId={paper.id} onReviewCreated={onRefresh} />
      )}

      {/* Existing Reviews */}
      {paper.reviews?.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Review Decisions</h3>
          <div className="space-y-4">
            {paper.reviews.map((review: any) => (
              <div key={review.id} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border-l-4 border-indigo-500">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={review.decision === 'APPROVE' ? 'success' : review.decision === 'REJECT' ? 'danger' : 'warning'}>
                    {review.decision}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {new Date(review.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{review.reason}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Reviewer: {review.reviewer?.name || 'Unknown'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SignalIcon({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    CRITICAL: 'text-red-500',
    HIGH: 'text-orange-500',
    MEDIUM: 'text-yellow-500',
    LOW: 'text-green-500',
  };

  return (
    <div className={`w-3 h-3 rounded-full ${severity === 'CRITICAL' ? 'bg-red-500' : severity === 'HIGH' ? 'bg-orange-500' : severity === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'}`} />
  );
}

function EvidenceDetail({ evidence }: { evidence: any }) {
  if (!evidence) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
      <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Evidence Detail</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Signal</dt>
          <dd className="font-medium text-slate-900 dark:text-white">{evidence.signalId}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Severity</dt>
          <dd><SeverityBadge severity={evidence.severity} /></dd>
        </div>
        <div>
          <dt className="text-slate-500">Source</dt>
          <dd className="font-medium text-slate-900 dark:text-white">{evidence.source}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Detected</dt>
          <dd className="text-slate-900 dark:text-white">{new Date(evidence.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
      {evidence.evidenceData && (
        <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">Raw Evidence Data</p>
          <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-auto">
            {JSON.stringify(evidence.evidenceData, null, 2)}
          </pre>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3 italic border-t pt-2">
        This is verified evidence from an external source — not an AI interpretation.
      </p>
    </div>
  );
}
