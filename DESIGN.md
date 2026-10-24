# HỆ THỐNG THIẾT KẾ TRUNG TÂM DỮ LIỆU SỐ — TRƯỜNG QUÂN SỰ QUÂN KHU 7
> **DESIGN.md** — Tài liệu đặc tả chuẩn mực về ngôn ngữ thiết kế, hệ thống thị giác (Design System) và nguyên tắc tương tác người dùng (UI/UX Specification).  
> *Được biên soạn theo chuẩn `VoltAgent/awesome-design-md`, tích hợp triết lý Anti-AI-Slop từ `Leonxlnx/taste-skill`, vật lý vi tương tác từ `Seokwoooo/lucian-uxui-prompt`, và hệ thống phản hồi thị giác từ `jolyui.dev`.*


---

## 0. QUY TRÌNH TƯ DUY & TÌM KIẾM UX/UI BẮT BUỘC (MANDATORY UX/UI DISCOVERY WORKFLOW)
> **BẮT BUỘC THỰC HIỆN TRƯỚC KHI VIẾT CODE:** Bất kỳ khi nào kỹ sư hoặc AI Agent nhận yêu cầu thiết kế mới, sửa đổi giao diện, thêm component hay tối ưu UX/UI trong dự án QK7 DataHub, **BẮT BUỘC** phải tuân thủ nghiêm ngặt quy trình 3 bước sau đây:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               QUY TRÌNH 3 BƯỚC THIẾT KẾ & TỐI ƯU UX/UI BẮT BUỘC                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 1: ĐỌC & KÍCH HOẠT TASTE-SKILL V2 (`SKILL.md`)                                    │
│   • Kích hoạt tư duy chống thẩm mỹ AI đại trà (Anti-AI-Slop).                          │
│   • Áp dụng quy chuẩn màn hình ứng dụng (`references/app-screens.md`).                  │
│   • Kiểm soát chặt chẽ tỷ lệ khoảng trắng, cấu trúc bề mặt đa tầng (Surface Hierarchy).│
│   • Ràng buộc Typography dứt khoát (`font-mono tabular-nums`), chuyển động lò xo.      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 2: TRA CỨU & ĐỐI CHIẾU TỪ AWESOME DESIGN SYSTEMS & KHO MICRO-INTERACTIONS         │
│   • Tra cứu chuẩn mực từ: https://github.com/alexpate/awesome-design-systems           │
│     (Carbon, Primer, Polaris, Atlassian, Geist, USWDS...) theo đúng bài toán nghiệp vụ.│
│   • Kết hợp kho vi tương tác:                                                          │
│     - Lucian Prompts (https://github.com/Seokwoooo/lucian-uxui-prompt): #098, #004... │
│     - JolyUI & Animated Toast (https://www.jolyui.dev/docs/components/feedback/toast)  │
│     - Awesome DESIGN.md (https://github.com/VoltAgent/awesome-design-md)               │
│     - AI Website Cloner Template (https://github.com/JCodesMore/ai-website-cloner)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BƯỚC 3: BẢN ĐỊA HÓA BẢN SẮC QUÂN ĐỘI NHÂN DÂN VIỆT NAM (TRIAD MILITARY COLOR SYSTEM)    │
│   • Primary: Xanh Lục Quân (#166534 / emerald).                                        │
│   • Secondary: Vàng Kim Quân Hiệu & Đồng Cổ (#fbbf24 / amber).                         │
│   • Accent/Danger: Đỏ Quân Kỳ (#b91c1c / red).                                         │
│   • Vận hành sắc nét và đồng bộ trên cả Light Mode & Dark Mode.                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Chi tiết 3 bước thực hiện:

#### Bước 1: Kích hoạt Taste-Skill v2 (`SKILL.md` / `.agents/skills/design-taste-frontend/`)
- Mở và đọc ngay [SKILL.md](file:///d:/QK7_DataHub/qk7-datahub/SKILL.md) và tài liệu kèm theo tại `.agents/skills/design-taste-frontend/`.
- Xác định rõ loại màn hình đang làm việc:
  - **App Screen** (Dashboard tổng quan, bảng danh sách văn bản, bộ lọc đa năng, cây đơn vị, log kiểm toán SOC, trình xem văn bản PDF): Tuân thủ nghiêm ngặt các quy tắc trong `references/app-screens.md` (viền tĩnh mỏng `border-white/10`, nhãn nhỏ rõ ràng, phân lớp surface có chiều sâu, tuyệt đối tránh dùng gradient cầu vồng, card bo tròn lòe loẹt hay icon đặt trong ô vuông màu bóng bẩy kiểu AI-slop).
  - **Hero / Banner**: Giữ sự uy nghiêm, vững chãi, nhịp thở trang trọng của cơ quan quân sự.
- Kiểm soát chuyển động vật lý: Sử dụng lò xo `cubic-bezier(.34, 1.45, .64, 1)` hoặc `cubic-bezier(.3, 1.25, .5, 1)`, triệt tiêu hoàn toàn chuyển động tuyến tính cứng nhắc.

#### Bước 2: Tra cứu & Đối chiếu từ Awesome Design Systems & Kho Thư Viện Mở
Trước khi tự sáng chế layout, hãy tra cứu các hệ sinh thái thiết kế hàng đầu thế giới từ [Awesome Design Systems](https://github.com/alexpate/awesome-design-systems) theo từng bài toán cụ thể:
1. **IBM Carbon Design System (`carbondesignsystem.com`):**
   - Áp dụng cho: Bảng dữ liệu mật độ cao (Data Tables), cấu trúc bộ lọc đa tiêu chí (Multi-criteria filters), phân trang tinh gọn và biểu đồ đo lường tài nguyên.
2. **GitHub Primer Design System (`primer.style`):**
   - Áp dụng cho: Nhật ký kiểm toán an ninh (Audit Logs), hiển thị Timeline hoạt động, huy hiệu trạng thái (Status Badges), phân cấp vai trò người dùng (Roles & Clearances).
3. **Shopify Polaris (`polaris.shopify.com`):**
   - Áp dụng cho: Bộ lọc kết hợp tìm kiếm (Index Filters), bố cục nhóm hành động hàng loạt (Bulk Actions), thanh tóm tắt chỉ số KPI.
4. **Atlassian Design System (`atlassian.design`):**
   - Áp dụng cho: Cây phân cấp tổ chức (Organization Tree View), điều hướng phân nhánh đơn vị, hộp thoại xác nhận bảo mật và modal phê duyệt vân tay.
5. **Vercel Geist Design System (`vercel.com/geist`):**
   - Áp dụng cho: Thẩm mỹ Dark Mode sâu thẳm, viền mạ hợp kim quang học mờ (`rgba(255,255,255,0.08)`), phân cấp chỉ số `tabular-nums` sắc nét.
6. **U.S. Web Design System - USWDS (`designsystem.digital.gov`):**
   - Áp dụng cho: Chuẩn mực cổng thông tin chính phủ & quân sự, quy chuẩn trợ năng (WCAG AA/AAA Accessibility), form hành chính công vụ nghiêm ngặt.

**Kết hợp với kho Micro-interactions mã nguồn mở của dự án:**
- **Lucian UX/UI Prompts (`github.com/Seokwoooo/lucian-uxui-prompt`):**
  - Prompt #098: Cuộn số đồng hồ cơ khí Odometer (`RollingNumber`) cho KPI và bảng thống kê.
  - Prompt #004: Nút tải tệp PDF biến hình thành thanh tiến trình (`CompactDownloadButton`).
  - Prompt #025: Khung nhập liệu nhãn bay vào khe viền (`NotchedInput`).
  - Prompt #219: Hiệu ứng vòng tròn lan tỏa quét sáng khi đổi theme (`ThemeToggle`).
  - Prompt #058: Thanh trượt vệt sáng bám dính khi chuyển tab (`Header Glider`).
- **JolyUI Animated Toast (`jolyui.dev`):** Toàn bộ thông báo nảy lò xo, đếm ngược tự đóng và xếp tầng thông minh.
- **Awesome DESIGN.md (`github.com/VoltAgent/awesome-design-md`):** Chuẩn cấu trúc tài liệu kiến trúc giao diện.
- **AI Website Cloner Template (`github.com/JCodesMore/ai-website-cloner-template`):** Phương pháp bóc tách 4 tầng (Layout -> Typography -> Surface -> Physics).

#### Bước 3: Bản Địa Hóa Sang Bản Sắc Quân Đội Nhân Dân Việt Nam
Toàn bộ pattern tiếp thu từ bên ngoài bắt buộc phải "khoác áo" ngôn ngữ thiết kế của Trường Quân Sự Quân Khu 7:
- **Màu chủ đạo (Primary):** Xanh Lục Quân (`#166534` Light • `#10b981` Dark • Emerald palette).
- **Màu tôn quý (Secondary):** Vàng Kim Quân Hiệu & Đồng Cổ (`#d97706` Light • `#fbbf24` Dark • Amber palette).
- **Màu điểm xuyết & Cảnh báo (Accent/Danger):** Đỏ Quân Kỳ (`#b91c1c` Light • `#f87171` Dark • Rose/Red palette).
- Bề mặt kính mờ quang học phản chiếu nhẹ vân hoa văn Trống đồng Đông Sơn.
- Hoạt động mượt mà, sắc nét trên cả Light Mode và Dark Mode.

---

## 1. TÔN CHỈ THIẾT KẾ: BẢN SẮC TRUNG TÂM CHỈ HUY QUÂN KHU HIỆN ĐẠI
*(Modern Military Tactical & Command Center Aesthetic)*

Mục tiêu tối thượng của giao diện **QK7 DataHub** là: **Có chiều sâu, có hồn, mang cá tính thiết kế thủ công tinh xảo (Human-crafted & Bespoke UI), tuyệt đối không mang dáng dấp công nghiệp, vô hồn hay rập khuôn do AI tạo ra.**

### 1.1. Bản Sắc Quân Đội & Truyền Thống Dân Tộc
- **Biểu tượng Trống đồng Đông Sơn & Bản đồ chữ S:** Họa tiết trống đồng ngàn năm lịch sử kết hợp cùng dải đất hình chữ S Việt Nam và quần đảo Hoàng Sa - Trường Sa, chuyển động quay chậm tự nhiên theo chiều kim đồng hồ (120s/vòng), thể hiện sự vững chãi, chủ quyền bất khả xâm phạm và dòng chảy thông tin dữ liệu số liên tục.
- **Không khí Trung tâm Chỉ huy Tác chiến Điện tử (Command Center):** Không sử dụng các bảng phẳng đơn điệu hay màu tím/xanh AI chung chung. Thay vào đó, giao diện mô phỏng một bảng điều khiển chỉ huy quân sự cấp chiến dịch:
  - Màn hình tối sâu (`#090e17`) tượng trưng cho phòng điều hành tác chiến đêm.
  - Các khối bề mặt phân lớp (`#111827`) với viền mạ hợp kim quang học có độ trong suốt (`border-emerald-500/20` hoặc `border-white/10`).
  - Ánh sáng viền chiến thuật (Tactical Glow) khi tập trung vào các tài liệu mật hoặc cảnh báo an ninh.

### 1.2. Hệ Màu Chủ Đạo (Triad Military Color System)
1. **Xanh Lục Quân (Army Green / `#166534` Light • `#10b981` Dark):**
   - Màu sắc căn bản của Quân đội Nhân dân Việt Nam.
   - Ứng dụng: Nút hành động chính (Primary Action), trạng thái Xác thực thành công, Cấp độ 1-2 Công khai & Nội bộ, luồng điều hướng hoạt động bình thường.
2. **Vàng Kim Quân Hiệu (Insignia Gold / `#d97706` Light • `#fbbf24` Dark / Accent `#d4af37`):**
   - Ánh kim của sao vàng, quân hàm, cấp bậc và huy hiệu danh dự.
   - Ứng dụng: Điểm nhấn viền tab trượt (Sliding Pill Highlight #058), thông báo lưu ý/kiểm duyệt, Cấp độ 3 Mật, số liệu đo lường trọng yếu.
3. **Đỏ Quân Kỳ (Flag Red / `#b91c1c` Light • `#f87171` Dark):**
   - Màu đỏ của Quốc kỳ và Quân kỳ Quyết thắng.
   - Ứng dụng: Cảnh báo an ninh SOC khẩn cấp, xâm nhập trái phép, Cấp độ 4-5 Tối Mật & Tuyệt Mật, nút xóa hoặc thu hồi quyền.

---

## 2. NĂM QUY TẮC "BẤT KHẢ XÂM PHẠM" CHỐNG THẨM MỸ AI ĐẠI TRÀ
*(Anti-AI-Slop Taste Skill Directives)*

Mọi kỹ sư hoặc AI Agent khi tham gia xây dựng/sửa đổi UI trên dự án **BẮT BUỘC** tuân thủ 5 điều sau:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   5 NGUYÊN TẮC VÀNG CHỐNG "AI-SLOP"                     │
├────┬───────────────────────┬────────────────────────┬───────────────────┤
│ STT│ QUY TẮC CẤM (AI-SLOP) │ GIẢI PHÁP THỦ CÔNG     │ ĐẶC TẢ KỸ THUẬT   │
├────┼───────────────────────┼────────────────────────┼───────────────────┤
│ 1  │ Chuyển động tuyến tính│ Đường cong vật lý      │ cubic-bezier      │
│    │ vô hồn (linear, ease) │ nảy lò xo (Spring)     │ (.34, 1.45, .64, 1│
├────┼───────────────────────┼────────────────────────┼───────────────────┤
│ 2  │ Nền & viền phẳng lì   │ Đa tầng bề mặt (Depth) │ backdrop-blur-md  │
│    │ không có độ sâu       │ & viền trong suốt mảnh │ border-white/10   │
├────┼───────────────────────┼────────────────────────┼───────────────────┤
│ 3  │ Alert/Toast mặc định  │ JolyUI Animated Toast  │ Dynamic Icon,     │
│    │ của trình duyệt       │ xếp chồng có spring    │ Countdown Bar     │
├────┼───────────────────────┼────────────────────────┼───────────────────┤
│ 4  │ Typography đồng dạng, │ Phân cấp dứt khoát:    │ font-mono         │
│    │ số liệu xộc xệch      │ telemetry & mã quân sự │ tabular-nums      │
├────┼───────────────────────┼────────────────────────┼───────────────────┤
│ 5  │ Nút bấm & ô nhập      │ Tương tác có sự sống   │ Active scale(0.97)│
│    │ tĩnh lặng, đơ cứng    │ (Stateful feedback)    │ Notched Inputs #25│
└────┴───────────────────────┴────────────────────────┴───────────────────┘
```

### Chi tiết 5 quy tắc:

#### Quy tắc 1: Không dùng chuyển động tuyến tính vô hồn (`linear` / `ease` mặc định)
- **Cấm:** `transition: all 0.3s ease;` hoặc `animation: fadeIn 0.2s linear;`.
- **Bắt buộc:** Mọi chuyển động bung mở modal, dropdown, trượt tab glider, toast thông báo phải áp dụng vật lý có độ nảy tự nhiên:
  - `--ux-spring: cubic-bezier(.34, 1.45, .64, 1)` cho các thành phần bung mở, popover, toast nảy vào.
  - `--ux-smooth: cubic-bezier(.2, .8, .2, 1)` cho trượt chuyển tab và co giãn kích thước.
  - Framer Motion config: `{ type: "spring", stiffness: 380, damping: 26, mass: 0.8 }`.

#### Quy tắc 2: Không dùng viền và nền phẳng lì (Layered Surfaces & Depth)
- **Cấm:** Hộp xám phẳng viền đen `bg-gray-100 border-gray-300` hoặc thẻ trắng bóng đổ nhợt nhạt `shadow-md`.
- **Bắt buộc:** Áp dụng kiến trúc phân tầng 3 lớp:
  - *Lớp Base:* Nền sâu `#090e17` (Dark) hoặc `#f8fafc` (Light) kết hợp radial vignette.
  - *Lớp Surface:* Kính mờ quang học `background: rgba(17, 24, 39, 0.85); backdrop-filter: blur(16px);`.
  - *Lớp Border:* Viền siêu mảnh có độ trong suốt cao `border: 1px solid rgba(255, 255, 255, 0.08)` trên nền tối, hoặc `border: 1px solid rgba(16, 185, 129, 0.2)` trên các khối dữ liệu quân sự trọng yếu.

#### Quy tắc 3: Toàn bộ phản hồi hệ thống dùng `AnimatedToast` (chuẩn JolyUI)
- **Cấm:** Dùng `window.alert()`, modal xác nhận thô kệch cho các phản hồi tức thì, hoặc toast phẳng biến mất đột ngột không báo trước.
- **Bắt buộc:** Dùng `AnimatedToastProvider` tích hợp sẵn:
  - Có thanh đếm ngược tự đóng (Dynamic Countdown Progress Bar) chạy mượt dưới đáy.
  - Hỗ trợ xếp chồng (Stacking) thông minh, tự động thu hẹp khi nhiều thông báo xuất hiện cùng lúc.
  - Icon trạng thái có hiệu ứng nảy (Spring Pop) kèm viền sáng phát quang (Glow Halo).
  - Tạm dừng đếm ngược khi người dùng rê chuột lên thông báo (Hover Pause).

#### Quy tắc 4: Typography có phân cấp sắc bén (Sharply Defined Telemetry Hierarchy)
- **Văn bản mô tả & Tiêu đề:** Dùng font tiếng Việt chuẩn quân đội `Be Vietnam Pro` (weights: 400 Regular, 600 SemiBold, 700 Bold, 800 ExtraBold).
- **Số liệu & Mã quân sự:** Bắt buộc áp dụng `font-mono tabular-nums` (sử dụng font `JetBrains Mono` kết hợp `tabular-nums`) cho:
  - Con số thống kê (KPIs, tổng văn bản, lượt truy cập).
  - Mã đơn vị (`QK7`, `SD309`, `TRGQS-QK7`).
  - Mã định danh quân nhân (`USR-001`, `AD-01`).
  - Địa chỉ IP mạng tác chiến (`127.0.0.1`, `10.7.0.45`).
  - Thời gian kiểm toán và dấu thời gian (`2026-10-24 16:08:59`).
  - Mã băm kiểm tra toàn vẹn tài liệu (SHA-256).

#### Quy tắc 5: Mọi nút bấm và ô nhập liệu đều có "Sự sống" (Stateful Micro-interactions)
- **Nút bấm (Buttons):**
  - Hover: Lực hút nhẹ kèm viền sáng nâng nhẹ (`translate-y-[-1px]`, `box-shadow` phát quang nhẹ).
  - Active: Độ lún vật lý chân thật (`transform: scale(0.97)`).
  - Nút tải tệp: Biến hình thành thanh tiến trình nạp (Lucian #004 Compact Progress Button).
- **Ô nhập liệu (Inputs):**
  - Áp dụng Notched Floating Label (Lucian #025): Khi focus hoặc có ký tự, nhãn bay nhịp nhàng vào khe viền trên của khung nhập, viền chuyển sắc sang Xanh Lục Quân hoặc Vàng Kim.
  - Khi có lỗi nhập: Lắc nhẹ viền đỏ (Shake error physics `cubic-bezier(.36,.07,.19,.97)`).

---

## 3. PHƯƠNG PHÁP BÓC TÁCH TỪNG LỚP KHI THIẾT KẾ & TÁI TẠO UI
*(Theo AI Website Cloner Template & Taste-Skill Workflow)*

Mỗi khi thiết kế hoặc refactor bất kỳ trang/thành phần nào trong hệ thống, thực hiện theo thứ tự 4 tầng sau:

```
┌────────────────────────────────────────────────────────┐
│ TẦNG 4: MICRO-MOTION & TƯƠNG TÁC VẬT LÝ (Spring Motion)│
├────────────────────────────────────────────────────────┤
│ TẦNG 3: CHIỀU SÂU BỀ MẶT (Layered Depth & Glassmorphism│
├────────────────────────────────────────────────────────┤
│ TẦNG 2: PHÂN CẤP TYPOGRAPHY & CHỈ SỐ TELEMETRY        │
├────────────────────────────────────────────────────────┤
│ TẦNG 1: BỐ CỤC KHÔNG GIAN & NHỊP ĐIỆU (Spatial Layout) │
└────────────────────────────────────────────────────────┘
```

1. **Tầng 1 — Layout & Spatial Rhythm:**
   - Đảm bảo cơ chế Dual-Platform: Desktop PC Widescreen (chuột phím, tối ưu thông tin, không độ trễ) và iPad Air M4 Touch UI (vùng chạm ≥44px, cử chỉ vuốt, Segmented Pill Glider).
   - Header co giãn thông minh 3 tầng (`≥1536px` / `1280–1535px` / `<1280px`), các cụm phím điều khiển trọng yếu luôn giữ `shrink-0 whitespace-nowrap`.
2. **Tầng 2 — Typography & Information Density:**
   - Tách bạch dứt khoát giữa ngữ nghĩa đọc (`Be Vietnam Pro`) và thông số máy móc (`JetBrains Mono tabular-nums`).
   - Cắt ngắn thông minh (smart truncation) kèm tooltip đầy đủ, không để tràn vỡ layout.
3. **Tầng 3 — Surface Depth & Tactility:**
   - Tạo độ nổi bằng viền quang học bán trong suốt thay vì bóng đổ mờ đục.
   - Sử dụng `glass-panel` với độ mờ `backdrop-blur-md` để hiển thị nền Trống đồng Đông Sơn lấp lánh nhẹ phía sau.
4. **Tầng 4 — Micro-motion & Physics:**
   - Gắn lò xo vào mọi phản hồi người dùng. Tốc độ tương tác phản ánh sự nhanh nhạy, kỷ luật của môi trường quân đội.

---

## 4. BẢNG TRA CỨU COMPONENT & NGUỒN CẢM HỨNG

| Thành phần | Nguồn tham chiếu | Mô tả tương tác | Trạng thái tích hợp |
| :--- | :--- | :--- | :--- |
| **Rolling Number (Odometer)** | Lucian Prompt #098 | Cuộn số đồng hồ cơ khí độc lập từng chữ số, nảy lò xo, diff thông minh | Đã tích hợp (`RollingNumber` trên 4 thẻ KPI, biểu đồ phân bố & Dashboard) |
| **Animated Toast** | `jolyui.dev` Animated Toast | Xếp chồng lò xo, thanh tiến trình tự đóng, icon phát quang | Đã tích hợp toàn hệ thống |
| **Circular Reveal Theme** | Lucian Prompt #219 | Chuyển đổi Dark/Light mode bằng đường tròn quét từ tâm nút bấm | Đã tích hợp (`ThemeToggle`) |
| **Sliding Pill Nav** | Lucian Prompt #058 | Vệt sáng trượt bám dính theo tab đang chọn, chuyển động 2 chiều | Đã tích hợp (`Header`, `DeviceModeSwitch`) |
| **Compact Progress Button** | Lucian Prompt #004 | Nút tải tệp PDF biến hình thành thanh tiến trình phần trăm | Đã tích hợp (`CompactDownloadButton`) |
| **Notched Input Field** | Lucian Prompt #025 | Nhãn bay vào khe viền khi focus, hiệu ứng rung lắc khi lỗi | Đã tích hợp (`NotchedInput`, `LoginForm`) |
| **Telemetry StatCard** | Tactical Dashboard + Taste Skill | Chỉ số font mono căn thẳng hàng tuyệt đối, viền phát quang theo cấp độ | Đã chuẩn hóa (`StatCard`, `UnitOverviewStrip`) |
| **High-Density Data Table** | IBM Carbon Design System | Bảng dữ liệu mật độ cao, hover hàng sáng nhẹ, phân trang inline | Đang áp dụng cho danh sách văn bản & log |
| **Security Audit Timeline** | GitHub Primer Design System | Cột mốc thời gian dọc, huy hiệu cấp độ bảo mật (Clearance Badges) | Đang áp dụng cho SOC Audit Log |
| **Government Form & A11y** | U.S. Web Design System (USWDS) | Chuẩn trợ năng tương phản cao, focus ring chiến thuật, nhãn rõ ràng | Đang áp dụng cho các modal & form nhập liệu |
| **Unit Organization Tree** | Atlassian Design System | Cây thư mục tổ chức đa cấp, phân nhánh mượt mà, quản lý đơn vị mồ côi | Đang áp dụng cho Bộ lọc Đơn vị & Cây tổ chức |

---

## 5. BẢNG TIÊU CHUẨN ĐÁNH GIÁ (DO'S & DON'TS MATRIX)

| Tiêu chí | CẤM (AI-Slop & Cẩu thả) | BẮT BUỘC (Bespoke & Military-Crafted) |
| :--- | :--- | :--- |
| **Bảng dữ liệu** | Bảng phẳng lì viền đặc, chữ nhỏ dính sát mép, không có hover state rõ ràng. | Phân cách hàng tinh tế, hover sáng nhẹ `emerald/5`, mã số dùng `font-mono tabular-nums`. |
| **Huy hiệu cấp mật** | Dùng các màu pastel tím/hồng nhạt vô nghĩa. | 5 Cấp độ mật chuẩn quân sự: Cấp 1 (Xanh xám), Cấp 2 (Xanh lục), Cấp 3 (Vàng kim), Cấp 4 (Cam đậm), Cấp 5 (Đỏ quân kỳ). |
| **Nút bấm** | Nút bấm phẳng lì, rê chuột không đổi sắc độ, bấm không có cảm giác cơ học. | Lực hút hover nhẹ, bấm lún `scale(0.97)`, bóng phản xạ ánh sáng kim loại. |
| **Thông báo** | Dùng alert trình duyệt giật cục hoặc notification AntD mặc định che khuất nội dung. | `AnimatedToast` góc dưới bên phải, có thanh đếm ngược, nảy lò xo mượt mà, xếp tầng thông minh. |
| **Thời gian & IP** | Hiển thị chữ thường co giãn khiến số nhảy lung tung khi cập nhật. | `font-mono tabular-nums` căn đều từng ký tự như máy đo radar quân sự. |

---
*Ghi chú cho AI Coding Agent: Trước khi bắt tay vào viết bất kỳ component hay chỉnh sửa giao diện nào trong thư mục `frontend/`, hãy đọc lại tài liệu này để đảm bảo giữ trọn vẹn bản sắc thiết kế thủ công tinh xảo của Trung Tâm Dữ Liệu Số — Quân Khu 7.*
