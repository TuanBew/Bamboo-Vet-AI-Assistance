'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { refreshMaterializedViews } from '@/app/admin/_actions/refresh-views'

export function AdminTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Build breadcrumb from pathname
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumb = segments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
    .join(' / ')

  function handleRefresh() {
    startTransition(async () => {
      const result = await refreshMaterializedViews()
      if (!result.success) {
        console.error('Refresh failed:', result.error)
      }
    })
  }

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center justify-between">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {breadcrumb}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
          className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Dang lam moi...' : 'Lam moi du lieu'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Dang xuat
        </Button>
      </div>
    </header>
  )
}
