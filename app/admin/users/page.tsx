'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function AdminUsersPage() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login');
    if (!loading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, loading, router]);

  if (loading || !isAuthenticated || !isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">User Management</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Admin-only user management (to be expanded).
        </p>
      </div>
    </DashboardLayout>
  );
}
