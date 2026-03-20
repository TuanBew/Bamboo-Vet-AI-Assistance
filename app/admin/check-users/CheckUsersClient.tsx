'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, ImageIcon } from 'lucide-react'
import { MapView, type MapPin } from '@/components/admin/MapView'
import { SectionHeader } from '@/components/admin/SectionHeader'
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'
import { ColorPivotTable } from '@/components/admin/ColorPivotTable'
import {
  UserHistoryDrawer,
  type Conversation,
  type Message,
} from '@/components/admin/UserHistoryDrawer'
import type {
  CheckUsersData,
  CheckUsersFilters,
} from '@/lib/admin/services/check-users'
import { USER_TYPE_COLORS } from '@/lib/admin/services/check-users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckUsersClientProps {
  initialData: CheckUsersData
  initialFilters: CheckUsersFilters
}

type UserRow = CheckUsersData['users']['data'][number] & {
  view_history: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVINCE_OPTIONS = [
  { value: '', label: 'Tat ca tinh' },
  { value: 'Ha Noi', label: 'Ha Noi' },
  { value: 'TP. Ho Chi Minh', label: 'TP. Ho Chi Minh' },
  { value: 'Da Nang', label: 'Da Nang' },
  { value: 'Can Tho', label: 'Can Tho' },
  { value: 'Hai Phong', label: 'Hai Phong' },
  { value: 'Dong Nai', label: 'Dong Nai' },
  { value: 'Binh Duong', label: 'Binh Duong' },
  { value: 'Thai Nguyen', label: 'Thai Nguyen' },
  { value: 'Khanh Hoa', label: 'Khanh Hoa' },
  { value: 'Thua Thien Hue', label: 'Thua Thien Hue' },
  { value: 'Nghe An', label: 'Nghe An' },
  { value: 'Lam Dong', label: 'Lam Dong' },
]

const USER_TYPE_OPTIONS = [
  { value: '', label: 'Tat ca loai' },
  { value: 'nhan_vien', label: 'Nhan vien' },
  { value: 'quan_ly', label: 'Quan ly' },
  { value: 'bac_si', label: 'Bac si' },
  { value: 'duoc_si', label: 'Duoc si' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CheckUsersClient({
  initialData,
  initialFilters,
}: CheckUsersClientProps) {
  const [data, setData] = useState<CheckUsersData>(initialData)
  const [filters, setFilters] = useState({
    search: initialFilters.search,
    province: initialFilters.province,
    user_type: initialFilters.user_type,
  })
  const [loading, setLoading] = useState(false)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUserName, setSelectedUserName] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | undefined>()
  const [messages, setMessages] = useState<Message[]>([])

  // -------------------------------------------------------------------------
  // Map pins
  // -------------------------------------------------------------------------

  const mapPins: MapPin[] = useMemo(
    () =>
      data.map_pins.map((p) => ({
        id: p.user_id,
        latitude: p.latitude,
        longitude: p.longitude,
        label: p.full_name,
        popupContent: `${p.full_name} (${p.clinic_type})`,
        color: USER_TYPE_COLORS[p.user_type] || '#06b6d4',
      })),
    [data.map_pins]
  )

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = useCallback(
    async (page: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filters.search) params.set('search', filters.search)
        if (filters.province) params.set('province', filters.province)
        if (filters.user_type) params.set('user_type', filters.user_type)
        params.set('page', String(page))
        params.set('page_size', '10')
        const res = await fetch(`/api/admin/check-users?${params}`)
        const newData: CheckUsersData = await res.json()
        setData(newData)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  const handleSearch = useCallback(() => {
    fetchData(1)
  }, [fetchData])

  const handlePageChange = useCallback(
    (page: number) => {
      fetchData(page)
    },
    [fetchData]
  )

  // -------------------------------------------------------------------------
  // Conversation history handlers
  // -------------------------------------------------------------------------

  const handleViewHistory = useCallback(async (userId: string, userName: string) => {
    setSelectedUserId(userId)
    setSelectedUserName(userName)
    setDrawerOpen(true)
    setConversations([])
    setMessages([])
    setSelectedConversation(undefined)
    try {
      const res = await fetch(`/api/admin/users/${userId}/conversations`)
      const convs = await res.json()
      setConversations(convs)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
  }, [])

  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setSelectedConversation(conv)
    setMessages([])
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/conversations/${conv.id}/messages`)
      const msgs = await res.json()
      setMessages(msgs)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }, [selectedUserId])

  // -------------------------------------------------------------------------
  // User table columns (11 data + 1 action)
  // -------------------------------------------------------------------------

  const userColumns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      { key: 'user_code', label: 'Ma KH', sortable: true },
      {
        key: 'full_name',
        label: 'Ten KH',
        sortable: true,
        render: (_v, row) => (
          <span className="text-cyan-400">{row.full_name}</span>
        ),
      },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Dia chi' },
      { key: 'district', label: 'Quan/Huyen' },
      { key: 'province', label: 'Tinh' },
      { key: 'clinic_type', label: 'Loai co so' },
      {
        key: 'clinic_image',
        label: 'Anh co so',
        sortable: false,
        render: () => (
          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-gray-500" />
          </div>
        ),
      },
      {
        key: 'created_at',
        label: 'Ngay tao',
        sortable: true,
        render: (v) => {
          const d = v as string
          if (!d) return ''
          const date = new Date(d)
          return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
        },
      },
      {
        key: 'is_geo_located' as keyof UserRow,
        label: 'Dinh vi',
        render: (v) => {
          const located = v as boolean
          return located ? (
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
              Da dinh vi
            </span>
          ) : (
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-gray-600/40 text-gray-400">
              Chua dinh vi
            </span>
          )
        },
      },
      {
        key: 'view_history',
        label: 'Lich su',
        sortable: false,
        render: (_v, row) => (
          <button
            onClick={() => handleViewHistory(row.user_id, row.full_name)}
            className="text-teal-400 hover:text-teal-300 text-xs underline whitespace-nowrap"
          >
            Xem lich su
          </button>
        ),
      },
    ],
    [handleViewHistory]
  )

  // Map user data to rows
  const userRows: UserRow[] = useMemo(
    () =>
      data.users.data.map((u) => ({
        ...u,
        view_history: '',
      })) as UserRow[],
    [data.users.data]
  )

  // -------------------------------------------------------------------------
  // Monthly pivot table
  // -------------------------------------------------------------------------

  const allMonths = useMemo(() => {
    const monthSet = new Set<string>()
    for (const row of data.monthly_pivot) {
      for (const key of Object.keys(row.months)) {
        monthSet.add(key)
      }
    }
    return Array.from(monthSet).sort()
  }, [data.monthly_pivot])

  const pivotRows = useMemo(
    () =>
      data.monthly_pivot.map((r) => ({
        id: r.user_id,
        label: r.full_name,
        values: r.months,
      })),
    [data.monthly_pivot]
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page title + breadcrumb */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Check Nguoi dung</h1>
        <div className="text-sm text-gray-400">
          Home / <span className="text-gray-200">Checkusers</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={filters.province}
          onChange={(e) =>
            setFilters((f) => ({ ...f, province: e.target.value }))
          }
          className="bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {PROVINCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filters.user_type}
          onChange={(e) =>
            setFilters((f) => ({ ...f, user_type: e.target.value }))
          }
          className="bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {USER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={filters.search}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value }))
          }
          placeholder="Tim kiem theo ten..."
          className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
        />

        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Section 1: Map */}
      <SectionHeader title="Vi tri nguoi dung" defaultOpen={true}>
        <MapView
          pins={mapPins}
          className="h-[350px]"
          center={[16.0, 106.0]}
          zoom={6}
        />
      </SectionHeader>

      {/* Section 2: User DataTable */}
      <SectionHeader title="Danh sach nguoi dung" defaultOpen={true}>
        <DataTable<UserRow>
          data={userRows}
          columns={userColumns}
          exportConfig={{
            copy: true,
            excel: true,
            csv: true,
            pdf: true,
            print: true,
          }}
          showSearch
          searchPlaceholder="Tim kiem..."
          totalCount={data.users.total}
          currentPage={data.users.page}
          onPageChange={handlePageChange}
          showPageSizeDropdown
        />
      </SectionHeader>

      {/* Section 3: Monthly Pivot */}
      <SectionHeader title="Thong ke hang thang" defaultOpen={true}>
        <ColorPivotTable
          rows={pivotRows}
          columns={allMonths}
          dimColumnLabels={[{ key: 'full_name', label: 'Ten nguoi dung', sticky: true }]}
          exportConfig={{ excel: true, copy: true }}
          searchPlaceholder="Tim kiem nguoi dung"
          showPageSizeDropdown
        />
      </SectionHeader>

      {/* User History Drawer */}
      <UserHistoryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        userName={selectedUserName}
        userId={selectedUserId}
        conversations={conversations}
        selectedConversation={selectedConversation}
        messages={messages}
        onSelectConversation={handleSelectConversation}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg px-6 py-3 text-white text-sm">
            Dang tai du lieu...
          </div>
        </div>
      )}
    </div>
  )
}
