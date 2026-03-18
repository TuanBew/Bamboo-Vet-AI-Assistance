'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { refreshMaterializedViews } from '@/app/admin/_actions/refresh-views'

export function RefreshButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleRefresh() {
    startTransition(async () => {
      const result = await refreshMaterializedViews()
      if (result.success) {
        router.refresh()
      } else {
        console.error('Refresh failed:', result.error)
      }
    })
  }

  return (
    <Button
      onClick={handleRefresh}
      disabled={isPending}
      className="bg-teal-600 hover:bg-teal-700 text-white"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Dang lam moi...' : 'Lam moi du lieu'}
    </Button>
  )
}
