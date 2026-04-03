import { redirect } from 'next/navigation'
import { requireModerator } from '@/lib/admin'
import AdminDashboard from './admin-dashboard.client'

export default async function AdminPage() {
  try {
    await requireModerator()
  } catch {
    redirect('/')
  }

  return <AdminDashboard />
}

