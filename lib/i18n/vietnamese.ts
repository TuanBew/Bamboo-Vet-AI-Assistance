/**
 * Vietnamese UI string dictionary for admin dashboard.
 * Admin is Vietnamese-only (SHELL-05) -- no multi-language needed.
 * Import: import { VI } from '@/lib/i18n/vietnamese'
 */
export const VI = {
  // Navigation (AdminSidebar)
  nav: {
    brandName: 'AI Bamboo',
    sectionCore: 'CORE',
    sectionChecked: 'CHECKED',
    sectionOther: 'OTHER',
    dashboard: 'Dashboard',
    nhapHang: 'Nhập hàng',
    tonKho: 'Tồn kho',
    khachHang: 'Khách hàng',
    checkCustomers: 'Check Khách hàng',
    checkDistributor: 'Check NPP',
    checkUsers: 'Check Users',
    checkClinics: 'Check Phòng khám',
    settings: 'Cài đặt',
  },

  // Top bar (AdminTopBar)
  topbar: {
    refresh: 'Làm mới dữ liệu',
    refreshing: 'Đang làm mới...',
    signOut: 'Đăng xuất',
  },

  // Export buttons (DataTable, ColorPivotTable)
  buttons: {
    copy: 'Copy',
    excel: 'Excel',
    csv: 'CSV',
    pdf: 'PDF',
    print: 'Print',
  },

  // Table/Pivot shared labels
  table: {
    search: 'Tìm kiếm...',
    noData: 'Không có dữ liệu',
    showing: 'Đang hiển thị',
    of: 'trong tổng số',
    records: 'bản ghi',
    display: 'Hiển thị',
    rows: 'dòng',
    rowsPerPage: 'Số dòng mỗi trang:',
    prev: 'Trước',
    next: 'Tiếp theo',
  },

  // Filter bar
  filter: {
    province: 'Tỉnh',
    district: 'Quận/Huyện',
    clinicType: 'Loại cơ sở',
    year: 'Năm',
    month: 'Tháng',
    search: 'Tìm kiếm',
    all: 'Tất cả',
    allProvinces: 'Tất cả tỉnh/thành',
    allDistricts: 'Tất cả quận/huyện',
    allClinicTypes: 'Tất cả loại cơ sở',
    filterHint: 'Bộ lọc áp dụng cho biểu đồ',
    npp: 'NPP',
    nhom: 'Nhóm',
    drugGroup: 'Nhóm thuốc',
    animalType: 'Loại vật nuôi',
    metric: 'Chỉ số',
  },

  // Dashboard page
  dashboard: {
    title: 'Dashboard',
    overview: 'Tổng quan',
    focusMetrics: 'Chỉ số tập trung',
    users: 'Người dùng',
    clinics: 'Phòng khám',
    totalSessions: 'Tổng phiên',
    totalQueries: 'Tổng câu hỏi',
    totalUsers: 'Tổng người dùng',
    totalDocuments: 'Tổng tài liệu',
    totalStaff: 'Tổng nhân viên',
  },

  // Nhap Hang page
  nhapHang: {
    title: 'Nhập hàng',
    totalOrders: 'Tổng đơn hàng',
    totalRevenue: 'Tổng doanh thu',
    totalQuantity: 'Tổng số lượng',
    avgOrderValue: 'Giá trị TB/đơn',
    totalProducts: 'Tổng sản phẩm',
    totalSuppliers: 'Tổng NCC',
    dailyRevenue: 'Doanh thu theo ngày',
    dailyQuantity: 'Số lượng theo ngày',
    top10Products: 'Top 10 sản phẩm',
    orderList: 'Danh sách đơn hàng',
  },

  // Ton Kho page
  tonKho: {
    title: 'Tồn kho',
    totalValue: 'Tổng giá trị tồn',
    totalQty: 'Tổng số lượng',
    skuCount: 'Số SKU',
    valueByGroup: 'Giá trị theo nhóm',
    valueByBrand: 'Giá trị theo thương hiệu',
    valueByCategory: 'Giá trị theo ngành hàng',
    qtyByGroup: 'Số lượng theo nhóm',
    qtyByBrand: 'Số lượng theo thương hiệu',
    qtyByCategory: 'Số lượng theo ngành hàng',
    productList: 'Danh sách sản phẩm tồn kho',
  },

  // Khach Hang page
  khachHang: {
    title: 'Khách hàng',
    newByMonth: 'Khách hàng mới theo tháng',
    byProvince: 'Theo tỉnh',
    byDistrict: 'Theo quận/huyện',
    allCustomers: 'Tất cả khách hàng',
    purchasingCustomers: 'Khách hàng đang mua hàng',
    highValueStores: 'Số lượng cửa hiệu thực phẩm >300K',
    active: 'Còn hoạt động',
    mapped: 'Đã phân tuyến',
    geoLocated: 'Đã định vị',
    storeTypes: 'Số loại cửa hiệu',
    typeCode: 'Mã',
    typeName: 'Loại cửa hiệu',
    count: 'Số lượng',
    pctTotal: '% theo Tổng KH',
    pctActive: '% theo KH còn hoạt động',
  },

  // Check Users page
  checkUsers: {
    title: 'Check Users',
    viewHistory: 'Xem lịch sử',
    conversationHistory: 'Lịch sử hội thoại',
    noConversations: 'Chưa có hội thoại',
    back: 'Quay lại',
  },

  // Check Clinics page
  checkClinics: {
    title: 'Check Phòng khám',
    region: 'Miền',
    zone: 'Vùng',
    province: 'Tỉnh',
    code: 'Mã',
    name: 'Tên',
    clinicDetail: 'Chi tiết phòng khám',
  },

  // Check Customers page
  checkCustomers: {
    title: 'Check Khách hàng',
    checkLocation: 'Check Location',
    brandRevenue: 'Doanh thu theo thương hiệu',
    displayPrograms: 'Chương trình trưng bày',
  },

  // Check Distributor page
  checkDistributor: {
    title: 'Check NPP',
    columnVisibility: 'Ẩn/Hiện cột',
    distributorDetail: 'Chi tiết NPP',
    staff: 'Nhân viên',
    day: 'Ngày',
    revenue: 'Doanh thu',
    customerCount: 'Số KH',
  },

  // Common
  common: {
    loading: 'Đang tải...',
    error: 'Lỗi',
    noData: 'Không có dữ liệu',
    close: 'Đóng',
    confirm: 'Xác nhận',
    cancel: 'Hủy',
  },
} as const

export type VIKeys = typeof VI
