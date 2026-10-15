/**
 * QK7 DATAHUB — Dữ liệu người dùng DEMO
 * ============================================
 * ⚠️ CẢNH BÁO: File này chứa thông tin đăng nhập demo
 * ⚠️ KHÔNG sử dụng cho môi trường production
 * ⚠️ KHÔNG commit vào git công khai
 * ============================================
 * 
 * Cấu trúc mỗi user:
 *   username: {
 *     password: string,     // mật khẩu
 *     level: number,        // 0=Khách, 1=Cán bộ, 2=Chỉ huy, 3=Thủ trưởng
 *     name: string          // tên hiển thị (tùy chọn)
 *   }
 * 
 * TODO: Thay bằng API call /api/auth/login khi có backend
 */

const DEMO_USERS = {
    // ============ CẤP 1 — CÁN BỘ ============
    'canbo_pcht': {
        password: 'qk7pass2026',
        level: 1,
        name: 'Cán bộ Phòng Chiêu Hồi - Tác Chiến'
    },
    
    // ============ CẤP 2 — CHỈ HUY ============
    'truongphong_ch': {
        password: 'qk7pass2026',
        level: 2,
        name: 'Trưởng phòng Chính Trị'
    },
    
    // ============ CẤP 3 — THỦ TRƯỞNG ============
    'quantri_btl': {
        password: 'qk7pass2026',
        level: 3,
        name: 'Quản trị viên BTL'
    }
};

// Cho phép dùng cả trong browser và Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DEMO_USERS;
}