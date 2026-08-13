'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UploadSection } from '@/components/paper/upload-section';

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Smart Scient Reviewer
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 italic">
            Evidence before decision.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
            Upload a scientific paper to begin AI-assisted review.
          </p>
        </div>

        {/* Upload */}
        <UploadSection />

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">AI-assisted</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Extracts claims, identifies methodology concerns, and maps evidence.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Evidence-based</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Verifies against Crossref, OpenAlex, and PubMed with full traceability.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Human-controlled</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Every decision is made by an authenticated reviewer with full audit trail.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
