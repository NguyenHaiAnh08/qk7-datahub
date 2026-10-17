import { Unit } from '../types/user';

export interface UnitTreeNode {
  title: string;
  value: string;
  key: string;
  children?: UnitTreeNode[];
}

/**
 * Chuyển danh sách UNIT (flat) → cây phân cấp cho TreeSelect.
 * Dựa vào parent_id. Node nào parent_id = null hoặc không tồn tại → node gốc.
 */
export function buildUnitTree(units: Unit[]): UnitTreeNode[] {
  if (!units || units.length === 0) return [];

  const map = new Map<string, UnitTreeNode & { _parentId?: string | null }>();
  const roots: UnitTreeNode[] = [];

  // Bước 1: Khởi tạo map
  for (const u of units) {
    map.set(u.unit_id, {
      title: u.name,
      value: u.unit_id,
      key: u.unit_id,
      children: [],
      _parentId: u.parent_id || null,
    });
  }

  // Bước 2: Nối cha-con
  for (const u of units) {
    const node = map.get(u.unit_id)!;
    const parentId = node._parentId;
    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Bước 3: Sort theo tên tiếng Việt + dọn children rỗng
  const sortRecursive = (nodes: UnitTreeNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        sortRecursive(n.children);
      } else {
        delete n.children;  // antd không cần children rỗng
      }
    }
  };
  sortRecursive(roots);

  return roots;
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