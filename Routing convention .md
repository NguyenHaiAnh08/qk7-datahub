# Routing Convention — TRƯỜNG QUÂN SỰ QUÂN KHU 7 DATAHUB

## Tổng quan

Dự án **TRƯỜNG QUÂN SỰ QUÂN KHU 7 DATAHUB** (frontend: React 18 + TypeScript + Ant Design) sử dụng **auto-discovery routing**
dựa trên `import.meta.glob` của Vite để tự động phát hiện và nạp các route module, cùng cách làm với
hệ thống POS-coffee nhưng được bổ sung thêm **lớp gác cổng theo Cấp Độ Mật (Clearance Guard)** —
yêu cầu bắt buộc của một hệ thống quản trị tài liệu quân sự 5 cấp độ mật.

Lợi ích giữ nguyên như mô hình gốc:

- **Giảm xung đột (conflict):** mỗi lập trình viên chỉ sửa file module route của mình, không đụng vào
  file gom route chung.
- **Dễ bảo trì:** route được tổ chức theo từng phân hệ nghiệp vụ (`auth`, `portal`, `my-unit`,
  `document-desk`, `admin`, `users`...).
- **Mở rộng tốt:** thêm phân hệ mới không ảnh hưởng các phân hệ đã có.
- **An toàn theo cấp mật:** mỗi route khai báo rõ `minClearance` và có yêu cầu vân tay hay không, tránh
  trường hợp một trang mới được thêm vào mà quên gắn kiểm soát phân quyền.

---

## Cấu trúc thư mục

```text
frontend/src/routes/
├─ routePaths.ts        # Single source of truth cho toàn bộ đường dẫn (URL) của hệ thống
├─ routeAccess.ts        # Ma trận phân quyền: Clearance Level Guard + Login Guard (ĐẶC THÙ QK7)
├─ getAppRoutes.ts       # Auto-discovery + gộp toàn bộ route từ modules/
├─ RouterProvider.tsx    # Component điều hướng, dùng hook useRoutes()
└─ modules/
   ├─ auth.routes.tsx           # /login
   ├─ portal.routes.tsx         # /portal (Trung tâm thư viện số)
   ├─ myUnit.routes.tsx         # /my-unit (Đơn vị của tôi)
   ├─ documentDesk.routes.tsx   # /document-desk (Bàn làm việc văn thư)
   ├─ admin.routes.tsx          # /admin-dashboard
   └─ users.routes.tsx          # /users
```

---

## Cách hoạt động

### 1. Auto-discovery

`getAppRoutes.ts` dùng:

```ts
import.meta.glob("./modules/*.routes.tsx", { eager: true });
```

để tự động nạp mọi file `*.routes.tsx` trong `modules/`. **Không cần sửa `getAppRoutes.ts` hay
`App.tsx`** mỗi khi thêm phân hệ mới.

### 2. Định dạng một module

Mỗi file module **export default** một object theo đúng khuôn mẫu:

```tsx
// frontend/src/routes/modules/myUnit.routes.tsx
import MyUnitPage from "../../pages/MyUnitPage";
import { ROUTE_PATHS } from "../routePaths";

export default {
  group: "my-unit", // Tên nhóm phân hệ
  order: 20, // Thứ tự sắp xếp (nhỏ hơn = sớm hơn)
  routes: [
    {
      path: ROUTE_PATHS.MY_UNIT,
      element: <MyUnitPage />,
      minClearance: 1, // Cấp mật tối thiểu được phép vào trang (1-5)
      requireFingerprint: false, // Trang chứa khung xem tài liệu Mật trở lên sẽ bật cờ này ở cấp component
    },
  ],
};
```

> **Lưu ý đặc thù QK7:** `minClearance` và `requireFingerprint` ở đây chỉ là **cổng vào trang**
> (route-level). Việc kiểm soát mở từng văn bản PDF cụ thể (Cấp 3/4/5) vẫn do
> `FingerprintScanModal` + header `X-Fingerprint-Token` xử lý ở tầng Gateway, theo đúng mô hình 3 tầng
> (UI Guard → Gateway Middleware → SQL Server Constraint) đã mô tả trong `SYSTEM_ARCHITECTURE.md` mục 4.

### 3. Phân nhóm route (Route grouping)

- `group: 'auth'` → route nằm **ngoài** Layout chính (trang `/login`, không có Header/Sidebar).
- Mọi `group` khác → route nằm **trong** Layout (route được bảo vệ, yêu cầu đã đăng nhập).

### 4. Lớp gác cổng theo Cấp Độ Mật — `routeAccess.ts` (ĐẶC THÙ QK7)

Khác với POS-coffee (chỉ có Login Guard), TRƯỜNG QUÂN SỰ QUÂN KHU 7 DATAHUB cần thêm một ma trận phân quyền áp dụng **trước
khi** route được render:

```ts
// frontend/src/routes/routeAccess.ts
export function canAccessRoute(
  route: AppRoute,
  user: AuthUser | null,
): boolean {
  if (!user) return route.group === "auth";
  const userClearance = user.clearance_level_id ?? 1;
  return userClearance >= (route.minClearance ?? 1);
}
```

`RouterProvider.tsx` gọi `canAccessRoute()` cho mỗi route khi dựng cây `useRoutes()`; nếu không đạt
điều kiện, điều hướng về `HttpErrorPage` (403) thay vì render trang. Đây là lớp **UI Guard** — lớp đầu
tiên trong mô hình bảo mật 3 tầng của hệ thống; Gateway Middleware và SQL Server Constraint vẫn là hai
lớp chặn độc lập phía sau, route guard không thay thế chúng.

### 5. Sắp xếp (Sorting)

Route được sort tăng dần theo `order` để đảm bảo thứ tự hiển thị ổn định (ví dụ trên thanh điều hướng
Header — xem mục "Quy tắc sort order" bên dưới).

---

## Checklist: Thêm route mới

### Bước 1 — Tạo page component

```tsx
// frontend/src/pages/MyNewPage.tsx
const MyNewPage = () => {
  return <div>Trang mới</div>;
};
export default MyNewPage;
```

### Bước 2 — Thêm path constant

```ts
// frontend/src/routes/routePaths.ts
export const ROUTE_PATHS = {
  // ...các path hiện có
  MY_NEW_PAGE: "/my-new-page",
};
```

### Bước 3 — Khai báo cấp mật tối thiểu (bắt buộc với QK7)

Trước khi gắn route vào module, xác định **ai được phép truy cập trang này** — tham chiếu Bảng 5 Cấp
Độ Mật trong `SYSTEM_ARCHITECTURE.md` mục 4.1 (`CONGKHAI` → `TUYETMAT`). Mặc định nếu không khai báo,
`minClearance` được hiểu là `1` (Công khai).

### Bước 4 — Tạo hoặc cập nhật module route

**Phương án A: Thêm vào module hiện có**

```tsx
// frontend/src/routes/modules/myUnit.routes.tsx
import MyNewPage from "../../pages/MyNewPage";
import { ROUTE_PATHS } from "../routePaths";

export default {
  group: "my-unit",
  order: 20,
  routes: [
    { path: ROUTE_PATHS.MY_UNIT, element: <MyUnitPage />, minClearance: 1 },
    { path: ROUTE_PATHS.MY_NEW_PAGE, element: <MyNewPage />, minClearance: 2 }, // ← route mới
  ],
};
```

**Phương án B: Tạo module mới**

```tsx
// frontend/src/routes/modules/myFeature.routes.tsx
import MyNewPage from "../../pages/MyNewPage";
import { ROUTE_PATHS } from "../routePaths";

export default {
  group: "my-feature", // Tên nhóm mới
  order: 70, // Order cao hơn mọi module hiện có
  routes: [
    {
      path: ROUTE_PATHS.MY_NEW_PAGE,
      element: <MyNewPage />,
      minClearance: 3,
      requireFingerprint: true,
    },
  ],
};
```

### Bước 5 — Cập nhật tài liệu kiến trúc

Thêm page/file mới vào mục 3 (`Sơ Đồ Cấu Trúc Mã Nguồn`) của `SYSTEM_ARCHITECTURE.md`, và nếu route
mới thuộc diện Cấp 3 trở lên, bổ sung ghi chú vào mục 4 (`Mô Hình Phân Quyền & Bảo Mật Đa Tầng`).

---

## Quy tắc sort order

| Khoảng `order` | Phân hệ                                         |
| :------------: | :---------------------------------------------- |
|     `0–9`      | Auth (`/login`)                                 |
|    `10–19`     | Portal — Trung tâm thư viện số                  |
|    `20–29`     | Đơn vị của tôi (`/my-unit`)                     |
|    `30–39`     | Bàn làm việc văn thư (`/document-desk`)         |
|    `40–49`     | Quản trị (`/admin-dashboard`, `/users`)         |
|     `50+`      | Phân hệ mới (tính năng bổ sung trong tương lai) |

**Lưu ý:** nếu thêm route vào module đã có, giữ nguyên `order` của module đó — chỉ cấp `order` mới khi
tạo hẳn một module/phân hệ mới.

---

## Ví dụ: Tạo module route mới hoàn chỉnh

```tsx
// frontend/src/routes/modules/reports.routes.tsx
import OperationReport from "../../pages/reports/OperationReport";
import SecuritySummary from "../../pages/reports/SecuritySummary";
import { ROUTE_PATHS } from "../routePaths";

export default {
  group: "reports",
  order: 60,
  routes: [
    {
      path: ROUTE_PATHS.OPERATION_REPORT,
      element: <OperationReport />,
      minClearance: 3,
    },
    {
      path: ROUTE_PATHS.SECURITY_SUMMARY,
      element: <SecuritySummary />,
      minClearance: 4,
      requireFingerprint: true,
    },
  ],
};
```

Sau khi tạo file này, route được tự động phát hiện và nạp — **không cần sửa `getAppRoutes.ts` hay
`App.tsx`**.

---

## Lưu ý quan trọng

1. **Không sửa `getAppRoutes.ts`** — file này tự động discover route, không import thủ công.
2. **Không sửa `App.tsx`** — `App.tsx` chỉ khởi tạo `ConfigProvider` (màu tím `#722ED1`), Auth, Theme;
   không chứa định nghĩa route.
3. **Luôn dùng `ROUTE_PATHS`** — không hardcode chuỗi path, luôn tham chiếu hằng số.
4. **Luôn khai báo `minClearance`** cho route mới — đây là điểm khác biệt bắt buộc so với mẫu
   POS-coffee gốc; bỏ sót sẽ khiến route mặc định mở ở Cấp 1 (Công khai), có nguy cơ lộ lọt thông tin.
5. **`export default`** — module route phải export default object, không dùng named export.
6. **Cập nhật tài liệu** — mỗi lần tạo file/route mới, cập nhật cả `SYSTEM_ARCHITECTURE.md` (mục 3 và
   mục 4 nếu liên quan đến cấp mật) để tài liệu kiến trúc luôn khớp với mã nguồn thực tế.
