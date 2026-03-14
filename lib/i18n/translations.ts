export type Language = 'vi' | 'en'

export type TranslationKey =
  | 'nav.brand' | 'nav.login' | 'nav.signup' | 'nav.logout' | 'nav.newChat' | 'nav.lang'
  | 'landing.badge' | 'landing.headline' | 'landing.subheadline' | 'landing.subheadline.en'
  | 'landing.cta' | 'landing.feature1.title' | 'landing.feature1.desc'
  | 'landing.feature2.title' | 'landing.feature2.desc'
  | 'landing.feature3.title' | 'landing.feature3.desc'
  | 'chat.placeholder' | 'chat.send' | 'chat.newChat' | 'chat.emptyState'
  | 'chat.nudge' | 'chat.nudge.dismiss'
  | 'sidebar.today' | 'sidebar.yesterday' | 'sidebar.older'
  | 'sidebar.rename' | 'sidebar.delete' | 'sidebar.deleteConfirm'
  | 'sidebar.deleteConfirmYes' | 'sidebar.deleteConfirmNo'
  | 'auth.email' | 'auth.password' | 'auth.name'
  | 'auth.login' | 'auth.signup' | 'auth.loginWithGoogle' | 'auth.signupWithGoogle'
  | 'auth.noAccount' | 'auth.hasAccount'
  | 'auth.error.invalidCredentials' | 'auth.error.emailExists'
  | 'error.generic' | 'error.retry' | 'error.rateLimit'
  | 'error.tooLong' | 'error.streamInterrupted'

export const translations: Record<Language, Record<TranslationKey, string>> = {
  vi: {
    'nav.brand': 'Bamboo Vet',
    'nav.login': 'Đăng nhập',
    'nav.signup': 'Đăng ký',
    'nav.logout': 'Đăng xuất',
    'nav.newChat': 'Cuộc trò chuyện mới',
    'nav.lang': 'VI / EN',
    'landing.badge': 'TRỢ LÝ THÚ Y AI',
    'landing.headline': 'Bamboo Vet AI Assistance',
    'landing.subheadline': 'Tra cứu thuốc, liều lượng & hướng dẫn điều trị tức thì',
    'landing.subheadline.en': 'Drug lookup, dosages & treatment guidance for vets',
    'landing.cta': 'Dùng thử ngay',
    'landing.feature1.title': 'Tra cứu thuốc',
    'landing.feature1.desc': 'Liều lượng theo loài & cân nặng',
    'landing.feature2.title': 'Chống chỉ định',
    'landing.feature2.desc': 'Tương tác thuốc & cảnh báo',
    'landing.feature3.title': 'Phác đồ điều trị',
    'landing.feature3.desc': 'Hướng dẫn điều trị chuẩn',
    'chat.placeholder': 'Nhập câu hỏi của bạn...',
    'chat.send': 'Gửi',
    'chat.newChat': 'Cuộc trò chuyện mới',
    'chat.emptyState': 'Hỏi bất kỳ điều gì về thuốc thú y',
    'chat.nudge': 'Lưu lịch sử trò chuyện — Đăng ký miễn phí',
    'chat.nudge.dismiss': 'Đóng',
    'sidebar.today': 'Hôm nay',
    'sidebar.yesterday': 'Hôm qua',
    'sidebar.older': 'Cũ hơn',
    'sidebar.rename': 'Đổi tên',
    'sidebar.delete': 'Xóa',
    'sidebar.deleteConfirm': 'Xóa cuộc trò chuyện này?',
    'sidebar.deleteConfirmYes': 'Xóa',
    'sidebar.deleteConfirmNo': 'Hủy',
    'auth.email': 'Email',
    'auth.password': 'Mật khẩu',
    'auth.name': 'Họ và tên',
    'auth.login': 'Đăng nhập',
    'auth.signup': 'Đăng ký',
    'auth.loginWithGoogle': 'Đăng nhập với Google',
    'auth.signupWithGoogle': 'Đăng ký với Google',
    'auth.noAccount': 'Chưa có tài khoản?',
    'auth.hasAccount': 'Đã có tài khoản?',
    'auth.error.invalidCredentials': 'Email hoặc mật khẩu không đúng.',
    'auth.error.emailExists': 'Email này đã được sử dụng.',
    'error.generic': 'Đã xảy ra lỗi. Vui lòng thử lại.',
    'error.retry': 'Thử lại',
    'error.rateLimit': 'Vui lòng thử lại sau.',
    'error.tooLong': 'Tin nhắn quá dài (tối đa 2000 ký tự).',
    'error.streamInterrupted': 'Phản hồi bị gián đoạn.',
  },
  en: {
    'nav.brand': 'Bamboo Vet',
    'nav.login': 'Login',
    'nav.signup': 'Sign up',
    'nav.logout': 'Log out',
    'nav.newChat': 'New conversation',
    'nav.lang': 'EN / VI',
    'landing.badge': 'VETERINARY AI ASSISTANT',
    'landing.headline': 'Bamboo Vet AI Assistance',
    'landing.subheadline': 'Drug lookup, dosages & treatment guidance',
    'landing.subheadline.en': 'Tra cứu thuốc thú y nhanh chóng & chính xác',
    'landing.cta': 'Try Now',
    'landing.feature1.title': 'Drug Lookup',
    'landing.feature1.desc': 'Dosages by species & weight',
    'landing.feature2.title': 'Contraindications',
    'landing.feature2.desc': 'Drug interactions & warnings',
    'landing.feature3.title': 'Treatment Protocols',
    'landing.feature3.desc': 'Standard treatment guidance',
    'chat.placeholder': 'Ask your question...',
    'chat.send': 'Send',
    'chat.newChat': 'New conversation',
    'chat.emptyState': 'Ask anything about veterinary medicine',
    'chat.nudge': 'Save your history — Sign up free',
    'chat.nudge.dismiss': 'Dismiss',
    'sidebar.today': 'Today',
    'sidebar.yesterday': 'Yesterday',
    'sidebar.older': 'Older',
    'sidebar.rename': 'Rename',
    'sidebar.delete': 'Delete',
    'sidebar.deleteConfirm': 'Delete this conversation?',
    'sidebar.deleteConfirmYes': 'Delete',
    'sidebar.deleteConfirmNo': 'Cancel',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Full name',
    'auth.login': 'Login',
    'auth.signup': 'Sign up',
    'auth.loginWithGoogle': 'Login with Google',
    'auth.signupWithGoogle': 'Sign up with Google',
    'auth.noAccount': 'No account yet?',
    'auth.hasAccount': 'Already have an account?',
    'auth.error.invalidCredentials': 'Incorrect email or password.',
    'auth.error.emailExists': 'This email is already in use.',
    'error.generic': 'Something went wrong. Please try again.',
    'error.retry': 'Retry',
    'error.rateLimit': 'Please wait and retry.',
    'error.tooLong': 'Message too long (max 2000 characters).',
    'error.streamInterrupted': 'Response was interrupted.',
  },
}
