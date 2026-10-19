import React, { useState, useMemo, useEffect } from 'react';
import {
  Building,
  Building2,
  Shield,
  ShieldCheck,
  Award,
  Flag,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Users,
  FolderOpen,
  FolderClosed,
  AlertTriangle,
  Layers,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { Unit } from '../../types';

export type UnitCategory =
  | 'all'
  | 'quan_khu'
  | 'su_doan'
  | 'trung_doan'
  | 'tieu_doan'
  | 'nha_truong'
  | 'phong_ban';

export interface UnitTreeNode {
  unit: Unit;
  level: number;
  children: UnitTreeNode[];
  parent: Unit | null;
  isOrphan?: boolean;
  directChildCount: number;
  totalDescendants: number;
  category: Exclude<UnitCategory, 'all'>;
}

export interface UnitTreeTableProps {
  units: Unit[];
  onAddRoot: () => void;
  onAddChild: (parentUnit: Unit) => void;
  onEdit: (unit: Unit) => void;
  onDelete: (unit: Unit) => void;
  onToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Phân loại đơn vị tự động theo Mã & Tên ──
export const getUnitCategory = (unit: Unit): Exclude<UnitCategory, 'all'> => {
  const id = (unit.unit_id || '').toUpperCase();
  const name = (unit.name || '').toLowerCase();

  if (id === 'QK7' || name.includes('quân khu') || name.includes('bộ tư lệnh')) {
    return 'quan_khu';
  }
  if (id.startsWith('SD') || name.includes('sư đoàn')) {
    return 'su_doan';
  }
  if (id.startsWith('TD') || name.includes('trung đoàn') || name.includes('lữ đoàn')) {
    return 'trung_doan';
  }
  if (
    id.startsWith('TB') ||
    id.startsWith('D') ||
    name.includes('tiểu đoàn') ||
    name.includes('đại đội')
  ) {
    return 'tieu_doan';
  }
  if (id.startsWith('TQS') || name.includes('trường') || name.includes('học viện') || name.includes('viện')) {
    return 'nha_truong';
  }
  return 'phong_ban';
};

// ── Cấu hình hiển thị theo loại đơn vị (Tương thích hoàn hảo Sáng & Tối) ──
export const CATEGORY_CONFIG: Record<
  Exclude<UnitCategory, 'all'>,
  {
    label: string;
    icon: React.ElementType;
    badgeClass: string;
    iconBgClass: string;
  }
> = {
  quan_khu: {
    label: 'Cấp Quân khu',
    icon: Award,
    badgeClass:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    iconBgClass:
      'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  },
  su_doan: {
    label: 'Sư đoàn',
    icon: Shield,
    badgeClass:
      'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30',
    iconBgClass:
      'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
  },
  trung_doan: {
    label: 'Trung đoàn',
    icon: ShieldCheck,
    badgeClass:
      'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30',
    iconBgClass:
      'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
  },
  tieu_doan: {
    label: 'Tiểu đoàn / Đội',
    icon: Flag,
    badgeClass:
      'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    iconBgClass:
      'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  nha_truong: {
    label: 'Nhà trường / Viện',
    icon: GraduationCap,
    badgeClass:
      'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
    iconBgClass:
      'bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
  },
  phong_ban: {
    label: 'Phòng / Ban / Cơ quan',
    icon: Building2,
    badgeClass:
      'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    iconBgClass:
      'bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
  },
};

// ── Hàm chuẩn hoá chuỗi tìm kiếm không dấu ──
function normalizeSearchText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const UnitTreeTable: React.FC<UnitTreeTableProps> = ({
  units,
  onAddRoot,
  onAddChild,
  onEdit,
  onDelete,
  onToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<UnitCategory>('all');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // ── Xây dựng cấu trúc cây đa cấp (Tree Data Structure) & Xử lý Nút Mồ côi ──
  const { rootNodes, orphanCount } = useMemo(() => {
    const map = new Map<string, Unit>();
    const childrenMap = new Map<string, Unit[]>();
    const roots: Unit[] = [];
    const orphans: Unit[] = [];

    // Bước 1: Lập bản đồ tra cứu
    for (const u of units) {
      map.set(u.unit_id, u);
      childrenMap.set(u.unit_id, []);
    }

    // Bước 2: Phân loại gốc, con và nút mồ côi
    for (const u of units) {
      const parentId = u.parent_id ? u.parent_id.trim() : '';
      if (!parentId) {
        roots.push(u);
      } else if (map.has(parentId)) {
        childrenMap.get(parentId)!.push(u);
      } else {
        // Nút mồ côi: có parent_id nhưng parent chưa tồn tại trong danh mục
        orphans.push(u);
      }
    }

    // Thứ tự ưu tiên sắp xếp quân sự
    const getSortWeight = (u: Unit): number => {
      const cat = getUnitCategory(u);
      if (cat === 'quan_khu') return 1;
      if (cat === 'su_doan') return 2;
      if (cat === 'nha_truong') return 3;
      if (cat === 'trung_doan') return 4;
      if (cat === 'tieu_doan') return 5;
      return 6;
    };

    const sortUnits = (list: Unit[]) => {
      list.sort((a, b) => {
        const wA = getSortWeight(a);
        const wB = getSortWeight(b);
        if (wA !== wB) return wA - wB;
        return a.name.localeCompare(b.name, 'vi');
      });
    };

    sortUnits(roots);
    for (const list of childrenMap.values()) {
      sortUnits(list);
    }
    sortUnits(orphans);

    // Bước 3: Đệ quy chuyển đổi sang UnitTreeNode
    const buildNode = (u: Unit, level: number, isOrphan = false): UnitTreeNode => {
      const rawChildren = childrenMap.get(u.unit_id) || [];
      const childrenNodes = rawChildren.map((child) => buildNode(child, level + 1, false));
      const totalDescendants = childrenNodes.reduce(
        (sum, child) => sum + 1 + child.totalDescendants,
        0
      );

      const parentUnit = u.parent_id ? map.get(u.parent_id) || null : null;

      return {
        unit: u,
        level,
        children: childrenNodes,
        parent: parentUnit,
        isOrphan,
        directChildCount: childrenNodes.length,
        totalDescendants,
        category: getUnitCategory(u),
      };
    };

    // Ghép roots chính thống và các nút mồ côi
    const allRootNodes: UnitTreeNode[] = [
      ...roots.map((r) => buildNode(r, 0, false)),
      ...orphans.map((o) => buildNode(o, 0, true)),
    ];

    return {
      rootNodes: allRootNodes,
      orphanCount: orphans.length,
    };
  }, [units]);

  // ── Mở rộng toàn bộ cây mặc định ban đầu để người dùng thấy đầy đủ các cấp ──
  useEffect(() => {
    const allParentKeys = new Set<string>();
    const collectParents = (nodes: UnitTreeNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          allParentKeys.add(node.unit.unit_id);
          collectParents(node.children);
        }
      }
    };
    collectParents(rootNodes);
    setExpandedKeys(allParentKeys);
  }, [rootNodes]);

  // ── Tính toán Mini Stat Pills ──
  const stats = useMemo(() => {
    let quanKhu = 0;
    let suDoan = 0;
    let trungDoan = 0;
    let tieuDoan = 0;
    let phongBan = 0;
    let nhaTruong = 0;

    for (const u of units) {
      const cat = getUnitCategory(u);
      if (cat === 'quan_khu') quanKhu++;
      else if (cat === 'su_doan') suDoan++;
      else if (cat === 'trung_doan') trungDoan++;
      else if (cat === 'tieu_doan') tieuDoan++;
      else if (cat === 'nha_truong') nhaTruong++;
      else phongBan++;
    }

    return {
      total: units.length,
      commandAndDivision: quanKhu + suDoan,
      regimentAndBattalion: trungDoan + tieuDoan,
      staffAndSchool: phongBan + nhaTruong,
      orphan: orphanCount,
    };
  }, [units, orphanCount]);

  // ── Xử lý Tìm kiếm Thông Minh & Tự động Mở Rộng Cha - Con ──
  const normalizedQuery = useMemo(() => normalizeSearchText(searchQuery), [searchQuery]);

  useEffect(() => {
    if (!normalizedQuery) return;

    const matchedAncestorKeys = new Set<string>();

    const checkMatch = (u: Unit): boolean => {
      const id = normalizeSearchText(u.unit_id);
      const name = normalizeSearchText(u.name);
      return id.includes(normalizedQuery) || name.includes(normalizedQuery);
    };

    const traverse = (node: UnitTreeNode, ancestorPath: string[]): boolean => {
      const isSelfMatch = checkMatch(node.unit);
      let isChildMatch = false;

      const currentPath = [...ancestorPath, node.unit.unit_id];

      for (const child of node.children) {
        const childMatched = traverse(child, currentPath);
        if (childMatched) isChildMatch = true;
      }

      if (isSelfMatch || isChildMatch) {
        for (const parentId of ancestorPath) {
          matchedAncestorKeys.add(parentId);
        }
        if (node.children.length > 0) {
          matchedAncestorKeys.add(node.unit.unit_id);
        }
        return true;
      }

      return false;
    };

    for (const root of rootNodes) {
      traverse(root, []);
    }

    if (matchedAncestorKeys.size > 0) {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        matchedAncestorKeys.forEach((key) => next.add(key));
        return next;
      });
    }
  }, [normalizedQuery, rootNodes]);

  // ── Thao tác Đóng / Mở cây ──
  const toggleExpand = (unitId: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allWithChildren = new Set<string>();
    const collectAll = (nodes: UnitTreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          allWithChildren.add(n.unit.unit_id);
          collectAll(n.children);
        }
      }
    };
    collectAll(rootNodes);
    setExpandedKeys(allWithChildren);
  };

  const handleCollapseAll = () => {
    setExpandedKeys(new Set());
  };

  // ── Kiểm tra hiển thị node theo Tìm kiếm & Bộ lọc ──
  const isNodeMatching = (node: UnitTreeNode): boolean => {
    if (selectedCategory !== 'all') {
      if (node.category !== selectedCategory) return false;
    }
    if (normalizedQuery) {
      const id = normalizeSearchText(node.unit.unit_id);
      const name = normalizeSearchText(node.unit.name);
      return id.includes(normalizedQuery) || name.includes(normalizedQuery);
    }
    return true;
  };

  const hasMatchingDescendant = (node: UnitTreeNode): boolean => {
    if (isNodeMatching(node)) return true;
    return node.children.some((child) => hasMatchingDescendant(child));
  };

  // ── Làm phẳng cây thành danh sách hàng hiển thị (Flatten for Table) ──
  interface FlatRow {
    node: UnitTreeNode;
    isExpanded: boolean;
    hasChildren: boolean;
    isLastChild: boolean;
    ancestorHasNextSibling: boolean[];
    isSelfMatched: boolean;
  }

  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];

    const flatten = (
      nodes: UnitTreeNode[],
      ancestorHasNext: boolean[] = []
    ) => {
      const visibleNodes = nodes.filter((n) => {
        if (!normalizedQuery && selectedCategory === 'all') return true;
        return hasMatchingDescendant(n);
      });

      visibleNodes.forEach((node, index) => {
        const isLastChild = index === visibleNodes.length - 1;
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedKeys.has(node.unit.unit_id);
        const isSelfMatched =
          Boolean(normalizedQuery || selectedCategory !== 'all') && isNodeMatching(node);

        rows.push({
          node,
          isExpanded,
          hasChildren,
          isLastChild,
          ancestorHasNextSibling: ancestorHasNext,
          isSelfMatched,
        });

        if (hasChildren && isExpanded) {
          flatten(node.children, [...ancestorHasNext, !isLastChild]);
        }
      });
    };

    flatten(rootNodes, []);
    return rows;
  }, [rootNodes, expandedKeys, normalizedQuery, selectedCategory]);

  // ── Highlight chữ khi tìm kiếm ──
  const renderHighlightedText = (text: string, isCode = false) => {
    if (!normalizedQuery) return text;

    const normText = normalizeSearchText(text);
    const matchIndex = normText.indexOf(normalizedQuery);
    if (matchIndex === -1) return text;

    const before = text.slice(0, matchIndex);
    const matched = text.slice(matchIndex, matchIndex + normalizedQuery.length);
    const after = text.slice(matchIndex + normalizedQuery.length);

    return (
      <>
        {before}
        <mark
          className={`rounded px-1 py-0.5 font-bold ${
            isCode
              ? 'bg-amber-300/80 text-amber-950 dark:bg-amber-400/40 dark:text-amber-200'
              : 'bg-purple-200 text-purple-900 dark:bg-purple-600/40 dark:text-purple-100'
          }`}
        >
          {matched}
        </mark>
        {after}
      </>
    );
  };

  // ── Xử lý Xóa an toàn (Safe Delete UX) ──
  const handleSafeDelete = (node: UnitTreeNode) => {
    if (node.directChildCount > 0) {
      if (onToast) {
        onToast(
          `Không thể xóa đơn vị "${node.unit.name}" vì đang có ${node.directChildCount} đơn vị cấp dưới trực thuộc. Vui lòng chuyển hoặc xóa các đơn vị con trước!`,
          'error'
        );
      } else {
        alert(
          `Không thể xóa đơn vị "${node.unit.name}" đang có cấp dưới trực thuộc. Vui lòng xóa hoặc chuyển các đơn vị con trước!`
        );
      }
      return;
    }
    onDelete(node.unit);
  };

  return (
    <div className="space-y-4">
      {/* ── 1. HEADER CHÍNH ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:border-purple-500/30 dark:text-purple-300 flex items-center justify-center shadow-xs">
              <Building className="w-5 h-5" />
            </div>
            <span>Danh Mục Đơn Vị Quân Khu</span>
            <span className="text-xs px-3 py-1 rounded-full font-mono font-bold bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30">
              {units.length} đơn vị
            </span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Cấu trúc cây phân cấp chỉ huy, phòng ban cơ quan và các đơn vị tác chiến trực thuộc Quân khu 7
          </p>
        </div>

        <button
          onClick={onAddRoot}
          className="px-3 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer shrink-0 border border-purple-500/30 active:scale-95"
          title="Tạo mới đơn vị cấp cao hoặc đơn vị độc lập"
        >
          <Plus className="w-3.5 h-3.5" /> Thêm đơn vị mới
        </button>
      </div>

      {/* ── 2. DẢI THẺ THỐNG KÊ THU GỌN (MINI STAT PILLS) — TỐI ƯU CẢ LIGHT & DARK MODE ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Pill 1: Tổng số */}
        <div
          onClick={() => setSelectedCategory('all')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            selectedCategory === 'all'
              ? 'bg-purple-100/90 border-purple-400 text-purple-950 dark:bg-purple-950/50 dark:border-purple-500/50 dark:text-white shadow-xs'
              : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/80 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Toàn quân khu</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                {stats.total} <span className="text-xs font-normal text-slate-500">đơn vị</span>
              </p>
            </div>
          </div>
          {selectedCategory === 'all' && (
            <div className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse" />
          )}
        </div>

        {/* Pill 2: Quân khu & Sư đoàn */}
        <div
          onClick={() =>
            setSelectedCategory((prev) => (prev === 'su_doan' ? 'all' : 'su_doan'))
          }
          className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            selectedCategory === 'su_doan' || selectedCategory === 'quan_khu'
              ? 'bg-purple-100/90 border-purple-400 text-purple-950 dark:bg-purple-950/50 dark:border-purple-500/50 dark:text-purple-300 shadow-xs'
              : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/80 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:border-purple-500/30 dark:text-purple-300 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">QK & Sư đoàn</p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-400 leading-tight">
                {stats.commandAndDivision}{' '}
                <span className="text-xs font-normal text-slate-500">đầu mối</span>
              </p>
            </div>
          </div>
          {(selectedCategory === 'su_doan' || selectedCategory === 'quan_khu') && (
            <div className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400" />
          )}
        </div>

        {/* Pill 3: Trung đoàn & Tiểu đoàn */}
        <div
          onClick={() =>
            setSelectedCategory((prev) => (prev === 'trung_doan' ? 'all' : 'trung_doan'))
          }
          className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            selectedCategory === 'trung_doan' || selectedCategory === 'tieu_doan'
              ? 'bg-cyan-100/90 border-cyan-400 text-cyan-950 dark:bg-cyan-950/50 dark:border-cyan-500/50 dark:text-cyan-300 shadow-xs'
              : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/80 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/15 dark:border-cyan-500/30 dark:text-cyan-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Trung / Tiểu đoàn</p>
              <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400 leading-tight">
                {stats.regimentAndBattalion}{' '}
                <span className="text-xs font-normal text-slate-500">đơn vị</span>
              </p>
            </div>
          </div>
          {(selectedCategory === 'trung_doan' || selectedCategory === 'tieu_doan') && (
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-600 dark:bg-cyan-400" />
          )}
        </div>

        {/* Pill 4: Phòng Ban & Trường */}
        <div
          onClick={() =>
            setSelectedCategory((prev) => (prev === 'phong_ban' ? 'all' : 'phong_ban'))
          }
          className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            selectedCategory === 'phong_ban' || selectedCategory === 'nha_truong'
              ? 'bg-sky-100/90 border-sky-400 text-sky-950 dark:bg-sky-950/50 dark:border-sky-500/50 dark:text-sky-300 shadow-xs'
              : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/80 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Phòng Ban & Trường</p>
              <p className="text-xl font-bold text-sky-700 dark:text-sky-400 leading-tight">
                {stats.staffAndSchool}{' '}
                <span className="text-xs font-normal text-slate-500">cơ quan</span>
              </p>
            </div>
          </div>
          {(selectedCategory === 'phong_ban' || selectedCategory === 'nha_truong') && (
            <div className="w-2.5 h-2.5 rounded-full bg-sky-600 dark:bg-sky-400" />
          )}
        </div>
      </div>

      {/* Cảnh báo nếu có nút mồ côi */}
      {orphanCount > 0 && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/25 rounded-xl flex items-center gap-3 text-sm text-amber-900 dark:text-amber-300">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-bold">Phát hiện {orphanCount} đơn vị có cấp trên chưa đăng ký:</span>{' '}
            Hệ thống đã tự động đưa các đơn vị này ra danh sách gốc kèm nhãn cảnh báo để tránh thất thoát dữ liệu.
          </div>
        </div>
      )}

      {/* ── 3. THANH TÌM KIẾM, BỘ LỌC VÀ NÚT MỞ RỘNG/THU GỌN ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã (QK7, TD4...) hoặc tên đơn vị..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full transition"
                title="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Bộ lọc phân loại đơn vị */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-slate-400 ml-1 hidden sm:block" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as UnitCategory)}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 transition-all font-semibold cursor-pointer"
            >
              <option value="all">Tất cả các cấp đơn vị</option>
              <option value="quan_khu">Cấp Quân khu</option>
              <option value="su_doan">Cấp Sư đoàn</option>
              <option value="trung_doan">Cấp Trung đoàn</option>
              <option value="tieu_doan">Cấp Tiểu đoàn / Đội</option>
              <option value="nha_truong">Nhà trường / Viện</option>
              <option value="phong_ban">Phòng / Ban / Cơ quan</option>
            </select>
          </div>
        </div>

        {/* Nút Mở rộng tất cả / Thu gọn tất cả */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button
            onClick={handleExpandAll}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-sm flex items-center gap-2 transition-all cursor-pointer border border-slate-300 dark:border-slate-700"
            title="Mở rộng tất cả các nhánh cấp dưới"
          >
            <FolderOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Mở rộng
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-sm flex items-center gap-2 transition-all cursor-pointer border border-slate-300 dark:border-slate-700"
            title="Thu gọn cây về cấp cao nhất"
          >
            <FolderClosed className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Thu gọn
          </button>
        </div>
      </div>

      {/* ── 4. BẢNG PHÂN CẤP CÂY (TREE TABLE UI) ── */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-800 dark:text-slate-200 min-w-[760px]">
            <thead className="bg-slate-100/90 dark:bg-slate-900/95 text-slate-700 dark:text-slate-300 uppercase text-xs border-b border-slate-200 dark:border-slate-800 font-bold tracking-wider">
              <tr>
                <th className="py-4 px-4 w-[44%] min-w-[320px]">Cấu Trúc Phân Cấp & Tên Đơn Vị</th>
                <th className="py-4 px-4 w-[15%]">Mã Định Danh</th>
                <th className="py-4 px-4 w-[21%]">Đơn Vị Cấp Trên</th>
                <th className="py-4 px-4 w-[10%] text-center">Quy Mô</th>
                <th className="py-4 px-4 w-[10%] text-right pr-5">Thao Tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {flatRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400 dark:text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <HelpCircle className="w-9 h-9 mx-auto text-slate-400" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300 text-base">Không tìm thấy đơn vị nào</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery || selectedCategory !== 'all'
                          ? 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc'
                          : 'Chưa có dữ liệu đơn vị trong hệ thống'}
                      </p>
                      {(searchQuery || selectedCategory !== 'all') && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedCategory('all');
                          }}
                          className="mt-2 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400 bg-purple-100 hover:bg-purple-200 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 border border-purple-300 dark:border-purple-500/30 rounded-lg transition"
                        >
                          Xóa bộ lọc tìm kiếm
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                flatRows.map(
                  ({
                    node,
                    isExpanded,
                    hasChildren,
                    ancestorHasNextSibling,
                    isSelfMatched,
                  }) => {
                    const { unit, level, category, isOrphan, directChildCount } = node;
                    const catCfg = CATEGORY_CONFIG[category];
                    const IconComp = catCfg.icon;

                    return (
                      <tr
                        key={unit.unit_id}
                        className={`group transition-all duration-200 ${
                          isSelfMatched
                            ? 'bg-purple-100/60 dark:bg-purple-950/30 border-l-4 border-l-purple-600'
                            : 'hover:bg-purple-50/40 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        {/* ── CỘT 1: CẤU TRÚC PHÂN CẤP & TÊN ĐƠN VỊ ── */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center">
                            {/* Dãy đường kẻ dẫn hướng thụt lề (Tree Guide Lines) */}
                            {level > 0 && (
                              <div
                                className="flex items-center shrink-0"
                                style={{ width: `${level * 28}px` }}
                              >
                                {Array.from({ length: level }).map((_, idx) => {
                                  const isLastLevel = idx === level - 1;
                                  return (
                                    <div
                                      key={idx}
                                      className="w-7 h-9 relative flex items-center justify-center shrink-0"
                                    >
                                      {/* Đường kẻ dọc nếu nhánh trước đó còn node anh em */}
                                      {!isLastLevel && ancestorHasNextSibling[idx] && (
                                        <div className="absolute top-0 bottom-0 left-3 w-px bg-slate-300 dark:bg-slate-700/60" />
                                      )}
                                      {/* Đầu nối nhánh L cho cấp hiện tại */}
                                      {isLastLevel && (
                                        <div className="absolute -top-4.5 bottom-4 left-3 w-4 border-l border-b border-slate-300 dark:border-slate-700/70 rounded-bl-sm" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Nút Toggle Mở/Đóng hoặc Dấu chấm căn dòng */}
                            <div className="w-6 h-6 flex items-center justify-center shrink-0 mr-2">
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(unit.unit_id);
                                  }}
                                  className="w-5.5 h-5.5 flex items-center justify-center rounded-md bg-white hover:bg-purple-50 border border-slate-300 text-slate-700 hover:text-purple-700 dark:bg-slate-800 dark:hover:bg-purple-900/60 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white transition-all cursor-pointer shadow-2xs"
                                  title={isExpanded ? 'Thu gọn cấp con' : 'Mở rộng cấp con'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                              )}
                            </div>

                            {/* Icon đại diện theo Loại đơn vị */}
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mr-3 shadow-2xs ${catCfg.iconBgClass}`}
                              title={catCfg.label}
                            >
                              <IconComp className="w-4 h-4" />
                            </div>

                            {/* Tên đơn vị */}
                            <div className="flex flex-col min-w-0 pr-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`truncate ${
                                    level === 0
                                      ? 'text-base font-bold text-slate-900 dark:text-white tracking-wide'
                                      : level === 1
                                      ? 'text-sm font-semibold text-slate-900 dark:text-slate-100'
                                      : 'text-sm font-medium text-slate-800 dark:text-slate-200'
                                  }`}
                                  title={unit.name}
                                >
                                  {renderHighlightedText(unit.name)}
                                </span>

                                {/* Nhãn loại đơn vị thu gọn */}
                                <span
                                  className={`text-xs px-2 py-0.5 rounded font-medium border ${catCfg.badgeClass}`}
                                >
                                  {catCfg.label}
                                </span>

                                {/* Nhãn cảnh báo nút mồ côi */}
                                {isOrphan && (
                                  <span className="text-xs px-2 py-0.5 rounded font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">
                                    ⚠️ Chưa khớp cấp trên
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ── CỘT 2: MÃ ĐỊNH DANH (BADGE MONOSPACE AMBER) ── */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className="bg-amber-100/90 text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25 font-mono text-sm px-3 py-1 rounded-lg font-bold tracking-wider inline-flex items-center shadow-2xs"
                            title={`Mã định danh đơn vị: ${unit.unit_id}`}
                          >
                            {renderHighlightedText(unit.unit_id, true)}
                          </span>
                        </td>

                        {/* ── CỘT 3: ĐƠN VỊ CẤP TRÊN (KHÔNG HIỂN THỊ MÃ ĐƠN VỊ, NẾU RỖNG THÌ ĐỂ TRỐNG —) ── */}
                        <td className="py-3.5 px-4">
                          {node.parent ? (
                            <span
                              className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate inline-block max-w-[240px]"
                              title={`Trực thuộc: ${node.parent.name}`}
                            >
                              {node.parent.name}
                            </span>
                          ) : unit.parent_id && isOrphan ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-400 font-medium"
                              title={`Cấp trên "${unit.parent_id}" chưa có bản ghi`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              Chưa có hồ sơ
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400 italic px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                              Cấp cao nhất
                            </span>
                          )}
                        </td>

                        {/* ── CỘT 4: QUY MÔ TRỰC THUỘC ── */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {directChildCount > 0 ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/25 shadow-2xs"
                              title={`${directChildCount} đơn vị cấp dưới trực tiếp (${node.totalDescendants} đơn vị tất cả các cấp con)`}
                            >
                              <Users className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                              {directChildCount} đơn vị
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                          )}
                        </td>

                        {/* ── CỘT 5: THAO TÁC (CONTEXTUAL ACTIONS) ── */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap pr-5">
                          <div className="inline-flex items-center gap-2">
                            {/* Nút +: Thêm đơn vị con trực thuộc */}
                            <button
                              type="button"
                              onClick={() => onAddChild(unit)}
                              className="p-2 bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-800 dark:bg-purple-500/15 dark:hover:bg-purple-500/25 dark:text-purple-300 dark:border-purple-500/30 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title={`Thêm đơn vị con trực thuộc "${unit.name}"`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>

                            {/* Nút Sửa: Mở Modal chỉnh sửa */}
                            <button
                              type="button"
                              onClick={() => onEdit(unit)}
                              className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                              title={`Sửa thông tin đơn vị "${unit.name}"`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Nút Xóa: Safe Delete UX có cảnh báo nếu có con */}
                            <button
                              type="button"
                              onClick={() => handleSafeDelete(node)}
                              className={`p-2 rounded-lg transition-all shadow-2xs ${
                                directChildCount > 0
                                  ? 'bg-slate-100 border border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                  : 'bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 dark:border-rose-900/40 cursor-pointer active:scale-95'
                              }`}
                              title={
                                directChildCount > 0
                                  ? `Không thể xóa: Có ${directChildCount} đơn vị cấp dưới trực thuộc`
                                  : `Xóa đơn vị "${unit.name}"`
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Chân bảng thông tin số liệu */}
        <div className="py-3 px-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2 font-medium">
          <div className="flex items-center gap-3">
            <span>
              Đang hiển thị <strong className="text-slate-900 dark:text-slate-100 font-bold">{flatRows.length}</strong> / {units.length} đơn vị
            </span>
            {selectedCategory !== 'all' && (
              <span className="text-purple-700 dark:text-purple-400 font-semibold">
                (Đang lọc theo: {CATEGORY_CONFIG[selectedCategory]?.label})
              </span>
            )}
            {searchQuery && (
              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                (Từ khóa: &quot;{searchQuery}&quot;)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span>Nhấp vào nút <strong className="text-purple-600 dark:text-purple-400 font-bold">+</strong> ở từng dòng để thêm cấp con</span>
          </div>
        </div>
      </div>
    </div>
  );
};
