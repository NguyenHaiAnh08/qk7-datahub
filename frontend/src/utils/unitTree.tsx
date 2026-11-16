import React from 'react';
import { Landmark, Building } from 'lucide-react';
import { Unit } from '../types/user';

export interface UnitTreeNode {
  title: React.ReactNode;
  value: string;
  key: string;
  name: string;
  isParent?: boolean;
  childCount?: number;
  children?: UnitTreeNode[];
}

/**
 * Trọng số sắp xếp đơn vị chuẩn quy chế Quân sự & Nhà trường:
 * 1. Cấp Quân khu (Quân khu 7, Bộ Tư lệnh QK7)
 * 2. Cấp Nhà trường (Trường Quân sự Quân khu 7)
 * 3. Cấp Sư đoàn (Sư đoàn 5)
 * 4. Ban Chỉ huy
 * 5. Trung đoàn / Lữ đoàn
 * 6. Cơ quan Đảng / Ủy Ban kiểm tra Đảng (BẮT BUỘC Ở TRÊN ĐẦU Ban Giám hiệu)
 * 7. Ban Giám hiệu (ở DƯỚI Ủy Ban kiểm tra Đảng)
 * 8. Phòng Đào tạo
 * 9. Phòng Chính trị
 * 10. Phòng Hậu cần - Kỹ thuật
 * 11. Phòng Tham mưu - Hành chính
 * 12. Các Phòng chức năng khác
 * 13. Các Tiểu đoàn (Tiểu đoàn 1 .. Tiểu đoàn 5)
 * 14. Các Khoa giáo viên (XẾP DƯỚI TIỂU ĐOÀN 5: Khoa Binh chủng, Khoa Binh chủng Hợp thành, Khoa Chuyên môn Kĩ thuật, Khoa KHXH&NV, Khoa Quân sự địa phương...)
 * 15. Trung tâm (Trung Tâm GDQP & AN)
 * 16. Lớp học viên / Lớp đào tạo (như Lớp Học viện Chính trị ở DƯỚI các Khoa & DƯỚI Tiểu đoàn 5)
 * 17. Đại đội
 * 18. Bộ môn
 * 19. Ban
 * 20. Tổ
 * 21-25. Cấp Trung ương / Bộ (BQP, BTTM, CP, TCCT)
 */
export function getMilitaryUnitSortWeight(u: { unit_id?: string; name?: string; unit_type?: string; parent_id?: string | null }): number {
  const id = (u.unit_id || '').toUpperCase().trim();
  const name = (u.name || '').toLowerCase().trim();
  const utype = (u.unit_type || '').toLowerCase().trim();

  // 1. Cấp Quân khu (cao nhất toàn quân khu)
  if (id === 'QK7' || name.includes('bộ tư lệnh') || name === 'quân khu 7' || utype === 'quan_khu') {
    return 1;
  }

  // 2. Nhà trường / Viện (Trường Quân sự Quân khu 7)
  if (
    id === 'TQS' ||
    id === 'TQS-QK7' ||
    id === 'U-TQS' ||
    (id.startsWith('TQS') && !u.parent_id?.startsWith('TQS') && !name.includes('khoa') && !name.includes('tiểu đoàn') && !name.includes('lớp')) ||
    (name.includes('trường quân sự') && !name.includes('khoa') && !name.includes('tiểu đoàn')) ||
    utype === 'nha_truong'
  ) {
    return 2;
  }

  // 3. Sư đoàn
  if (id.startsWith('SD') || id.startsWith('SĐ') || name.includes('sư đoàn') || utype === 'su_doan') {
    return 3;
  }

  // 4. Ban Chỉ huy
  if (name.includes('ban chỉ huy') || name.includes('bch') || id.startsWith('BCH') || utype === 'ban_chi_huy') {
    return 4;
  }

  // 5. Trung đoàn / Lữ đoàn
  if (name.includes('trung đoàn') || name.includes('lữ đoàn') || utype === 'trung_doan') {
    return 5;
  }

  // 6. Ủy Ban kiểm tra Đảng / Cơ quan Đảng (BẮT BUỘC Ở TRÊN ĐẦU Ban Giám hiệu)
  if (
    id.includes('UBKT') ||
    name.includes('kiểm tra đảng') ||
    name.includes('ủy ban kiểm tra') ||
    (name.includes('cơ quan') && name.includes('đảng')) ||
    utype === 'co_quan'
  ) {
    return 6;
  }

  // 7. Ban Giám hiệu (ở DƯỚI Ủy Ban kiểm tra Đảng)
  if (id.includes('BGH') || name.includes('giám hiệu')) {
    return 7;
  }

  // 8-12. Các Phòng chức năng Nhà trường (Đào tạo -> Chính trị -> HCKT -> TMHC)
  if (id.includes('PĐT') || id.includes('PDT') || (name.includes('đào tạo') && !name.includes('ban') && !name.includes('tổ'))) {
    return 8;
  }
  if (
    id.includes('PCT') ||
    name.includes('phòng chính trị') ||
    (name.includes('chính trị') && !name.includes('lớp') && !name.includes('khoa') && !name.includes('ban'))
  ) {
    return 9;
  }
  if (id.includes('HCKT') || (name.includes('hậu cần') && !name.includes('ban')) || (name.includes('kỹ thuật') && name.includes('phòng'))) {
    return 10;
  }
  if (id.includes('TMHC') || (name.includes('tham mưu') && !name.includes('ban')) || (name.includes('hành chính') && name.includes('phòng'))) {
    return 11;
  }
  if (utype === 'phong' || name.startsWith('phòng')) {
    return 12;
  }

  // 13. Các Tiểu đoàn (Tiểu đoàn 1 .. Tiểu đoàn 5)
  if (
    utype === 'tieu_doan' ||
    name.includes('tiểu đoàn') ||
    (id.startsWith('D') && !id.startsWith('DT') && !id.startsWith('DA'))
  ) {
    return 13;
  }

  // 14. Các Khoa giáo viên (XẾP DƯỚI TIỂU ĐOÀN 5)
  if (
    utype === 'khoa' ||
    name.includes('khoa') ||
    id.startsWith('K-') ||
    id.startsWith('K_') ||
    (id.startsWith('K') && id.includes('TQSQK'))
  ) {
    return 14;
  }

  // 15. Trung tâm (Trung Tâm GDQP & AN)
  if (utype === 'trung_tam' || name.includes('trung tâm') || id.startsWith('TT')) {
    return 15;
  }

  // 16. Lớp học viên / Lớp đào tạo (như Lớp Học viện Chính trị ở DƯỚI các Khoa & DƯỚI Tiểu đoàn 5)
  if (utype === 'lop' || name.includes('lớp') || id.startsWith('L-') || id.startsWith('L_') || id.includes('LH')) {
    return 16;
  }

  // 17. Đại đội
  if (utype === 'dai_doi' || name.includes('đại đội') || id.startsWith('C-') || id.startsWith('C_')) {
    return 17;
  }

  // 18. Bộ môn
  if (utype === 'bo_mon' || name.includes('bộ môn') || id.startsWith('BM-') || id.startsWith('BM_')) {
    return 18;
  }

  // 19. Ban
  if (utype === 'ban' || name.includes('ban') || id.startsWith('B-') || id.startsWith('B_')) {
    return 19;
  }

  // 20. Tổ
  if (utype === 'to' || name.includes('tổ') || id.startsWith('TO-') || id.startsWith('TO_')) {
    return 20;
  }

  // 21-25. Cấp Trung ương / Bộ (Chính phủ, BQP, BTTM, TCCT)
  if (utype === 'trung_uong' || id === 'BQP' || id === 'BTTM' || id === 'CP' || id === 'TCCT') {
    if (id === 'BQP') return 21;
    if (id === 'BTTM') return 22;
    if (id === 'CP') return 23;
    if (id === 'TCCT') return 24;
    return 25;
  }

  return 30;
}

/**
 * Chuyển danh sách UNIT (flat) → cây phân cấp cho TreeSelect có UI/UX phân cấp cha - con rõ ràng.
 * Node cha: Hiển thị icon Cơ quan, in đậm, badge số lượng phòng ban con.
 * Node con: Hiển thị icon Phòng ban, thụt lề, tag Trực thuộc.
 */
export function buildUnitTree(units: Unit[]): UnitTreeNode[] {
  if (!units || units.length === 0) return [];

  const map = new Map<string, {
    unit: Unit;
    children: Unit[];
  }>();

  // Bước 1: Khởi tạo danh sách
  for (const u of units) {
    map.set(u.unit_id, { unit: u, children: [] });
  }

  const rootUnits: Unit[] = [];
  for (const u of units) {
    if (u.parent_id && map.has(u.parent_id)) {
      map.get(u.parent_id)!.children.push(u);
    } else {
      rootUnits.push(u);
    }
  }

  // Helper ưu tiên phân cấp quân sự: Áp dụng chuẩn quy chế toàn hệ thống
  const sortUnitsWithPriority = (list: Unit[]) => {
    list.sort((a, b) => {
      const wA = getMilitaryUnitSortWeight(a);
      const wB = getMilitaryUnitSortWeight(b);
      if (wA !== wB) return wA - wB;
      return a.name.localeCompare(b.name, 'vi');
    });
  };

  // Bước 2: Sort theo thứ tự ưu tiên & tiếng Việt
  sortUnitsWithPriority(rootUnits);
  for (const item of map.values()) {
    sortUnitsWithPriority(item.children);
  }

  // Bước 3: Tạo node với UI cha - con trực quan theo cấp độ (depth)
  const createNode = (u: Unit, isParent: boolean, childCount: number, depth: number = 0): UnitTreeNode => {
    return {
      value: u.unit_id,
      key: u.unit_id,
      name: u.name,
      isParent,
      childCount,
      title: (
        <div className="flex items-center w-full py-0.5 pr-1 gap-2.5 select-none leading-none">
          {depth === 0 ? (
            <div className="w-5 h-5 rounded-md bg-amber-500/15 dark:bg-amber-900/40 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300 shadow-xs">
              <Landmark className="w-3.5 h-3.5" />
            </div>
          ) : isParent ? (
            <div className="w-4 h-4 rounded-md bg-emerald-500/15 dark:bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-300">
              <Building className="w-2.5 h-2.5" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
              <Building className="w-2.5 h-2.5" />
            </div>
          )}
          <span
            className={`whitespace-nowrap text-xs ${
              depth === 0
                ? 'font-bold text-slate-900 dark:text-slate-100'
                : isParent
                ? 'font-semibold text-slate-800 dark:text-slate-200'
                : 'font-normal text-slate-700 dark:text-slate-300'
            }`}
          >
            {u.name}
          </span>
        </div>
      ),
    };
  };

  // Bước 4: Đệ quy ghép cây đa cấp (Hỗ trợ vô hạn cấp: Cơ quan -> Phòng -> Ban / Đội...)
  const buildNodeRecursive = (u: Unit, depth: number = 0): UnitTreeNode => {
    const group = map.get(u.unit_id);
    const childrenUnits = group ? group.children : [];
    const hasChildren = childrenUnits.length > 0;

    const node = createNode(u, hasChildren, childrenUnits.length, depth);
    if (hasChildren) {
      node.children = childrenUnits.map((child) => buildNodeRecursive(child, depth + 1));
    }
    return node;
  };

  return rootUnits.map((root) => buildNodeRecursive(root, 0));
}

/**
 * Tìm path đầy đủ của 1 unit_id (VD: "QUÂN KHU 7 — TRƯỜNG QUÂN SỰ").
 * Dùng để hiển thị text cho form nếu cần.
 */
export function getUnitFullPath(units: Unit[], unitId: string): string {
  if (!unitId) return '';
  const map = new Map<string, Unit>();
  for (const u of units) map.set(u.unit_id, u);

  const parts: string[] = [];
  let current = map.get(unitId);
  let guard = 0;
  while (current && guard < 10) {
    parts.unshift(current.name);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
    guard++;
  }
  return parts.join(' — ');
}

/**
 * Lọc danh sách đơn vị cho phạm vi Trường Quân sự Quân khu 7:
 * - Giữ lại "Quân khu 7" (cha)
 * - "Trường Quân sự Quân khu 7" (con)
 * - Toàn bộ các phòng ban / đơn vị trực thuộc Trường Quân sự Quân khu 7
 * - Ẩn các đơn vị khác (Sư đoàn 309, Sư đoàn 5, các trung đoàn/tiểu đoàn khác...)
 */
/**
 * Kiểm tra xem một unit_id hoặc đơn vị có phải là Trường Quân sự Quân khu 7 hay không
 */
export function isSchoolUnitId(unitId?: string, units?: Unit[]): boolean {
  if (!unitId) return false;
  const upper = unitId.toUpperCase().trim();
  if (upper === 'TQS' || upper === 'TQS-QK7' || upper === 'U-TQS') return true;
  if (units && units.length > 0) {
    const u = units.find((x) => x.unit_id === unitId);
    if (u) {
      const name = (u.name || '').toLowerCase();
      if (name.includes('trường quân sự') || name.startsWith('trường quân sự')) return true;
    }
  }
  return false;
}

/**
 * Tìm đối tượng đơn vị Trường Quân sự Quân khu 7 trong danh sách
 */
export function findSchoolUnit(units: Unit[]): Unit | undefined {
  if (!units || units.length === 0) return undefined;
  return units.find(
    (u) =>
      u.unit_id === 'TQS-QK7' ||
      u.unit_id === 'TQS' ||
      u.unit_id === 'U-TQS' ||
      (u.unit_id.startsWith('TQS') && !u.parent_id?.startsWith('TQS')) ||
      (u.name.toLowerCase().includes('trường quân sự') && u.name.toLowerCase().includes('quân khu 7')) ||
      u.name.toLowerCase().startsWith('trường quân sự')
  );
}

export function filterSchoolUnits(units: Unit[], currentUnitId?: string): Unit[] {
  if (!units || units.length === 0) return [];

  // 1. Tìm đơn vị Trường Quân sự Quân khu 7 (TQS / TQS-QK7)
  const tqsUnit = findSchoolUnit(units);

  if (!tqsUnit) return units;

  // 2. Thu thập toàn bộ ID các đơn vị con cháu trực thuộc TQS
  const allowedUnitIds = new Set<string>();
  allowedUnitIds.add(tqsUnit.unit_id);

  let addedMore = true;
  while (addedMore) {
    addedMore = false;
    for (const u of units) {
      if (u.parent_id && allowedUnitIds.has(u.parent_id) && !allowedUnitIds.has(u.unit_id)) {
        allowedUnitIds.add(u.unit_id);
        addedMore = true;
      }
    }
  }

  // 3. Thu thập các cấp cha của TQS (Quân khu 7)
  let currParentId = tqsUnit.parent_id;
  while (currParentId) {
    allowedUnitIds.add(currParentId);
    const parentUnit = units.find((u) => u.unit_id === currParentId);
    currParentId = parentUnit?.parent_id;
  }

  // 4. Giữ lại currentUnitId nếu có để tránh mất lựa chọn khi edit user cũ
  if (currentUnitId) {
    allowedUnitIds.add(currentUnitId);
  }

  return units.filter((u) => allowedUnitIds.has(u.unit_id));
}

/**
 * Thứ tự ưu tiên hiển thị đơn vị ban hành theo chuẩn quân sự:
 * 1. Trường quân sự Quân khu 7
 * 2. Quân khu 7
 * 3. Bộ Tổng Tham mưu
 * 4. Tổng cục Chính trị
 * 5. Bộ Quốc Phòng
 * 6. Chính Phủ
 * 7. Sư đoàn 5
 * (các đơn vị được thêm sau sẽ thêm ở dưới dần dần)
 */
export function getIssuingUnitPriority(u: { unit_id?: string; name?: string }): number {
  const id = (u.unit_id || '').toUpperCase().trim();
  const name = (u.name || '').toLowerCase().trim();

  // 1. Trường quân sự Quân khu 7
  if (
    id === 'TQS' ||
    id === 'TQS-QK7' ||
    id === 'U-TQS' ||
    (name.includes('trường quân sự') && name.includes('quân khu 7')) ||
    name.startsWith('trường quân sự')
  ) {
    return 1;
  }
  // 2. Quân khu 7
  if (id === 'QK7' || name === 'quân khu 7' || (name.includes('quân khu 7') && !name.includes('trường'))) {
    return 2;
  }
  // 3. Bộ Tổng Tham mưu
  if (id === 'BTTM' || name.includes('tổng tham mưu')) {
    return 3;
  }
  // 4. Tổng cục Chính trị
  if (id === 'TCCT' || name.includes('tổng cục chính trị')) {
    return 4;
  }
  // 5. Bộ Quốc Phòng
  if (id === 'BQP' || name.includes('bộ quốc phòng')) {
    return 5;
  }
  // 6. Chính Phủ
  if (id === 'CP' || name.includes('chính phủ')) {
    return 6;
  }
  // 7. Sư đoàn 5
  if (id === 'SD5' || id === 'SĐ5-QK7' || name.includes('sư đoàn 5') || name.includes('f5')) {
    return 7;
  }

  // Các đơn vị được thêm sau sẽ thêm ở dưới dần dần
  return 999;
}

/**
 * Thu thập toàn bộ ID các phòng ban và đơn vị con cháu trực thuộc Trường Quân sự Quân khu 7
 */
export function getSchoolDescendantUnitIds(units: Unit[]): Set<string> {
  const ids = new Set<string>();
  if (!units || units.length === 0) return ids;

  const schoolUnit = findSchoolUnit(units);
  const schoolId = schoolUnit?.unit_id || 'TQS-QK7';

  const isDirectChildOfSchool = (parentId?: string | null): boolean => {
    if (!parentId) return false;
    const p = parentId.trim();
    return (
      p === schoolId ||
      p === 'TQS' ||
      p === 'TQS-QK7' ||
      p === 'U-TQS'
    );
  };

  let added = true;
  while (added) {
    added = false;
    for (const u of units) {
      if (!ids.has(u.unit_id)) {
        if (
          isDirectChildOfSchool(u.parent_id) ||
          (u.parent_id && ids.has(u.parent_id))
        ) {
          ids.add(u.unit_id);
          added = true;
        }
      }
    }
  }
  return ids;
}

/**
 * Lấy danh sách các cơ quan ban hành chính (loại trừ các phòng ban / đơn vị con cháu nội bộ của Trường Quân sự)
 * Chuẩn hóa danh sách: TQS, QK7, BTTM, TCCT, BQP, CP, SD5...
 */
export function getMainIssuingUnits(units: Unit[]): Unit[] {
  if (!units || units.length === 0) return [];
  const tqsDescendantIds = getSchoolDescendantUnitIds(units);
  const schoolUnit = findSchoolUnit(units);
  const schoolId = schoolUnit?.unit_id || 'TQS-QK7';

  const isDirectChildOfSchool = (parentId?: string | null): boolean => {
    if (!parentId) return false;
    const p = parentId.trim();
    return (
      p === schoolId ||
      p === 'TQS' ||
      p === 'TQS-QK7' ||
      p === 'U-TQS'
    );
  };

  const mainList = units.filter(
    (u) =>
      !tqsDescendantIds.has(u.unit_id) &&
      !isDirectChildOfSchool(u.parent_id)
  );

  return mainList.sort((a, b) => {
    const pA = getIssuingUnitPriority(a);
    const pB = getIssuingUnitPriority(b);
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name, 'vi');
  });
}

/**
 * Xây dựng cây phân cấp các phòng ban và đơn vị con cháu trực thuộc Trường Quân sự
 * Có tiền tố thụt lề chuẩn xác:
 * - Ban Giám hiệu
 * - Phòng Chính trị
 * - Phòng Đào tạo
 * - Phòng Hậu cần - Kỹ thuật
 *   └─ Bếp cơ quan
 * - Phòng Tham mưu - Hành chính
 */
export function getSchoolDepartmentsTree(
  units: Unit[]
): (Unit & { displayName: string; level: number })[] {
  if (!units || units.length === 0) return [];
  const tqsDescendantIds = getSchoolDescendantUnitIds(units);
  const schoolUnit = findSchoolUnit(units);
  const schoolId = schoolUnit?.unit_id || 'TQS-QK7';

  const isDirectChildOfSchool = (parentId?: string | null): boolean => {
    if (!parentId) return false;
    const p = parentId.trim();
    return (
      p === schoolId ||
      p === 'TQS' ||
      p === 'TQS-QK7' ||
      p === 'U-TQS'
    );
  };

  if (tqsDescendantIds.size === 0) {
    return [
      { unit_id: 'U-BGH', name: 'Ban Giám hiệu', displayName: 'Ban Giám hiệu', level: 0 },
      { unit_id: 'U-TM', name: 'Phòng Tham mưu - Hành chính', displayName: 'Phòng Tham mưu - Hành chính', level: 0 },
      { unit_id: 'U-CT', name: 'Phòng Chính trị', displayName: 'Phòng Chính trị', level: 0 },
      { unit_id: 'U-DT', name: 'Phòng Đào tạo', displayName: 'Phòng Đào tạo', level: 0 },
      { unit_id: 'U-HC', name: 'Phòng Hậu cần - Kỹ thuật', displayName: 'Phòng Hậu cần - Kỹ thuật', level: 0 },
    ] as (Unit & { displayName: string; level: number })[];
  }

  const map = new Map<string, Unit>();
  const childrenMap = new Map<string, Unit[]>();
  for (const u of units) {
    if (tqsDescendantIds.has(u.unit_id)) {
      map.set(u.unit_id, u);
      childrenMap.set(u.unit_id, []);
    }
  }

  const roots: Unit[] = [];
  for (const u of units) {
    if (tqsDescendantIds.has(u.unit_id)) {
      if (isDirectChildOfSchool(u.parent_id) || !map.has(u.parent_id || '')) {
        roots.push(u);
      } else if (u.parent_id && childrenMap.has(u.parent_id)) {
        childrenMap.get(u.parent_id)!.push(u);
      }
    }
  }

  roots.sort((a, b) => {
    const wA = getMilitaryUnitSortWeight(a);
    const wB = getMilitaryUnitSortWeight(b);
    if (wA !== wB) return wA - wB;
    return a.name.localeCompare(b.name, 'vi');
  });
  for (const children of childrenMap.values()) {
    children.sort((a, b) => {
      const wA = getMilitaryUnitSortWeight(a);
      const wB = getMilitaryUnitSortWeight(b);
      if (wA !== wB) return wA - wB;
      return a.name.localeCompare(b.name, 'vi');
    });
  }

  const flatList: (Unit & { displayName: string; level: number })[] = [];
  const traverse = (u: Unit, level: number) => {
    const indent = level === 0 ? '' : '— '.repeat(level);
    flatList.push({
      ...u,
      displayName: `${indent}${u.name}`,
      level,
    });
    const children = childrenMap.get(u.unit_id) || [];
    for (const child of children) {
      traverse(child, level + 1);
    }
  };

  for (const r of roots) {
    traverse(r, 0);
  }

  return flatList;
}
