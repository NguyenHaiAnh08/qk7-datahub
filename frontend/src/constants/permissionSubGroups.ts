import { Permission, SubGroupInfo, SubGroupTone } from '../types/user';

// ═══════════════════════════════════════════════════════════
// STYLE CHO MỖI TONE
// ═══════════════════════════════════════════════════════════
export const SUBGROUP_TONE_STYLE: Record<
  SubGroupTone,
  {
    label: string;
    dot: string;
    bg: string;
    border: string;
    text: string;
    badge: string;
  }
> = {
  read: {
    label: 'Xem / Tra cứu',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50/60 dark:bg-emerald-500/5',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    badge:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  write: {
    label: 'Ghi / Chỉnh sửa',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50/60 dark:bg-amber-500/5',
    border: 'border-amber-200 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    badge:
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  },
  security: {
    label: 'Bảo mật / Phân quyền',
    dot: 'bg-purple-500',
    bg: 'bg-purple-50/60 dark:bg-purple-500/5',
    border: 'border-purple-200 dark:border-purple-500/30',
    text: 'text-purple-700 dark:text-purple-400',
    badge:
      'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
  },
  danger: {
    label: 'Nguy hiểm',
    dot: 'bg-rose-500',
    bg: 'bg-rose-50/60 dark:bg-rose-500/5',
    border: 'border-rose-200 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-400',
    badge:
      'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  },
};

// ═══════════════════════════════════════════════════════════
// PRIORITY — tone nào "cao hơn" khi sub-group có mixed-tone
// danger > security > write > read
// ═══════════════════════════════════════════════════════════
export const TONE_PRIORITY: Record<SubGroupTone, number> = {
  danger: 4,
  security: 3,
  write: 2,
  read: 1,
};

// ═══════════════════════════════════════════════════════════
// HELPER — Đọc subgroup info từ 1 permission (DB-driven)
// ═══════════════════════════════════════════════════════════
export function getSubGroupFromPermission(p: Permission): SubGroupInfo {
  return {
    key: p.subgroup_key || `custom-${p.group_code || 'system'}`,
    label: p.subgroup_label || 'Tùy chỉnh',
    order: p.subgroup_order ?? 50,
    tone: (p.subgroup_tone as SubGroupTone) || 'read',
  };
}

// ═══════════════════════════════════════════════════════════
// HELPER — Gom 1 mảng permission thành các sub-group (dùng cho tab Catalog admin)
// ═══════════════════════════════════════════════════════════
export function groupPermissionsBySubGroup<T extends Permission>(
  permissions: T[]
): Array<{ subgroup: SubGroupInfo; permissions: T[] }> {
  const map = new Map<
    string,
    { info: SubGroupInfo; perms: T[]; tones: Set<SubGroupTone> }
  >();

  for (const p of permissions) {
    const sg = getSubGroupFromPermission(p);
    if (!map.has(sg.key)) {
      map.set(sg.key, { info: sg, perms: [], tones: new Set() });
    }
    const entry = map.get(sg.key)!;
    entry.perms.push(p);
    entry.tones.add(sg.tone);
  }

  return Array.from(map.values())
    .map(({ info, perms, tones }) => {
      const tonesArr = Array.from(tones);
      const maxTone = tonesArr.reduce<SubGroupTone>(
        (acc, t) => (TONE_PRIORITY[t] > TONE_PRIORITY[acc] ? t : acc),
        'read'
      );
      return {
        subgroup: {
          ...info,
          tone: maxTone,
          mixedTone: tones.size > 1,
        },
        permissions: perms.sort((a, b) =>
          (a.code || '').localeCompare(b.code || '')
        ),
      };
    })
    .sort((a, b) => a.subgroup.order - b.subgroup.order);
}