'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PaperReport } from '@/components/paper/paper-report';
import { Button } from '@/components/ui/button';

export default function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      loadPaper();
    }
  }, [isAuthenticated, authLoading, id]);

  async function loadPaper() {
    try {
      const data = await api.papers.report(id);
      setPaper(data);
    } catch (err: any) {
      setError('Paper not found');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      await api.papers.analyze(id);
      await loadPaper();
    } catch (err: any) {
      setError(err?.body?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !paper) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-red-600">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/')}>
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Actions */}
        {paper?.analysisStatus === 'PENDING' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Document uploaded. Ready for analysis.
            </p>
            <Button onClick={handleAnalyze} loading={analyzing}>
              Start Analysis
            </Button>
          </div>
        )}

        {analyzing && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
            <ProcessingStates />
          </div>
        )}

        {error && paper && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Report */}
        {paper && <PaperReport paper={paper} onRefresh={loadPaper} />}
      </div>
    </DashboardLayout>
  );
}

function ProcessingStates() {
  const states = [
    'Extracting metadata',
    'Verifying DOI',
    'Checking publication status',
    'Checking retractions',
    'Verifying references',
    'Analyzing claims',
    'Generating report',
  ];

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((c) => (c < states.length - 1 ? c + 1 : c));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white text-center mb-4">
        Analyzing paper...
      </h3>
      {states.map((state, i) => (
        <div key={state} className="flex items-center gap-3">
          {i < current ? (
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : i === current ? (
            <div className="w-5 h-5 flex items-center justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center">
              <div className="w-2 h-2 bg-slate-300 rounded-full" />
            </div>
          )}
          <span className={`text-sm ${i <= current ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
            {state}
          </span>
        </div>
      ))}
    </div>
  );
}
