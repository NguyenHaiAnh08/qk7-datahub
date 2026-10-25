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

  // Bước 2: Sort theo tiếng Việt
  rootUnits.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  for (const item of map.values()) {
    item.children.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
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
export function filterSchoolUnits(units: Unit[], currentUnitId?: string): Unit[] {
  if (!units || units.length === 0) return [];

  // 1. Tìm đơn vị Trường Quân sự Quân khu 7 (TQS)
  const tqsUnit = units.find(
    (u) =>
      u.unit_id === 'TQS' ||
      u.name.toLowerCase().includes('trường quân sự')
  );

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
