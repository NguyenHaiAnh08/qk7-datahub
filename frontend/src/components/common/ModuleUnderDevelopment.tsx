import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MonitorPlay,
  Layers,
  Library,
  ArrowLeft,
  Video,
  Users,
  TrendingUp,
  Box,
  HelpCircle,
  Map,
  BookOpen,
  Award,
  ShieldCheck,
  Shield,
  Sparkles,
} from 'lucide-react';
import { ROUTE_PATHS } from '../../routes/routePaths';

export type EcosystemModuleType =
  | 'lectures'
  | 'materials'
  | 'library'
  | 'bai-giang'
  | 'bai-giang-so'
  | 'hoc-lieu'
  | 'hoc-lieu-so'
  | 'thu-vien'
  | 'thu-vien-so'
  | string;

export interface ModuleUnderDevelopmentProps {
  module?: EcosystemModuleType;
  moduleType?: EcosystemModuleType;
  title?: string;
  description?: string;
  onBack?: () => void;
}

interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ModuleDetails {
  moduleKey: 'lectures' | 'materials' | 'library';
  moduleName: string;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  features: FeatureItem[];
}

interface ThemeClasses {
  accentName: string;
  sysNodeLoc: string;
  gridClass: string;
  ambientGlow: string;
  cardBorder: string;
  cornerBorder: string;
  cornerText: string;
  statusBadge: string;
  statusDot: string;
  iconContainer: string;
  iconColor: string;
  ctaButton: string;
  featureBorderHover: string;
  featureIconBox: string;
  featureTitleHover: string;
  statusTag: string;
  statusTagDot: string;
  sectionHeaderColor: string;
}

const THEME_CONFIG: Record<'lectures' | 'materials' | 'library', ThemeClasses> = {
  // 1. Cyber Cyan / Xanh Dương Điện Tử cho Bài giảng số
  lectures: {
    accentName: 'Cyber Cyan',
    sysNodeLoc: 'TQS_QK7_CYBER_ELEARN',
    gridClass: 'bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:20px_20px]',
    ambientGlow: 'from-cyan-600/30 via-sky-500/20 to-cyan-700/30',
    cardBorder: 'border-cyan-500/30 dark:border-cyan-500/40',
    cornerBorder: 'border-cyan-500 dark:border-cyan-400',
    cornerText: 'text-cyan-700 dark:text-cyan-400',
    statusBadge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    statusDot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]',
    iconContainer:
      'bg-gradient-to-br from-cyan-500/20 via-sky-500/15 to-cyan-700/25 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 shadow-cyan-950/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    ctaButton:
      'bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white border-cyan-400/40 shadow-lg shadow-cyan-950/30 hover:shadow-cyan-900/50',
    featureBorderHover: 'hover:border-cyan-500/40',
    featureIconBox:
      'bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500/25 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400',
    featureTitleHover: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
    statusTag: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    statusTagDot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]',
    sectionHeaderColor: 'text-cyan-700 dark:text-cyan-400',
  },

  // 2. Tactical Amber / Vàng Kim Hổ Phách cho Học liệu số
  materials: {
    accentName: 'Tactical Amber',
    sysNodeLoc: 'TQS_QK7_TACTICAL_3D',
    gridClass: 'bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:20px_20px]',
    ambientGlow: 'from-amber-600/30 via-yellow-500/20 to-amber-700/30',
    cardBorder: 'border-amber-500/30 dark:border-amber-500/40',
    cornerBorder: 'border-amber-500 dark:border-amber-400',
    cornerText: 'text-amber-700 dark:text-amber-400',
    statusBadge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    statusDot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    iconContainer:
      'bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-amber-700/25 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-amber-950/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    ctaButton:
      'bg-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 text-white border-amber-400/40 shadow-lg shadow-amber-950/30 hover:shadow-amber-900/50',
    featureBorderHover: 'hover:border-amber-500/40',
    featureIconBox:
      'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/25 dark:border-amber-500/30 text-amber-700 dark:text-amber-400',
    featureTitleHover: 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
    statusTag: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    statusTagDot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    sectionHeaderColor: 'text-amber-700 dark:text-amber-400',
  },

  // 3. Tactical Cobalt / Xanh Lam Tác Chiến cho Thư viện số (Hoàn toàn độc lập với Xanh Lục Quân)
  library: {
    accentName: 'Tactical Cobalt',
    sysNodeLoc: 'TQS_QK7_COBALT_ARCHIVE',
    gridClass: 'bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:20px_20px]',
    ambientGlow: 'from-blue-700/30 via-indigo-600/20 to-blue-800/30',
    cardBorder: 'border-blue-500/30 dark:border-blue-500/40',
    cornerBorder: 'border-blue-600 dark:border-blue-400',
    cornerText: 'text-blue-700 dark:text-blue-400',
    statusBadge: 'bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    statusDot: 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)]',
    iconContainer:
      'bg-gradient-to-br from-blue-600/20 via-indigo-600/15 to-blue-700/25 border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-blue-950/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    ctaButton:
      'bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 text-white border-blue-400/40 shadow-lg shadow-blue-950/30 hover:shadow-blue-900/50',
    featureBorderHover: 'hover:border-blue-500/40',
    featureIconBox:
      'bg-blue-600/10 dark:bg-blue-500/15 border-blue-500/25 dark:border-blue-500/30 text-blue-700 dark:text-blue-400',
    featureTitleHover: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    statusTag: 'bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    statusTagDot: 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)]',
    sectionHeaderColor: 'text-blue-700 dark:text-blue-400',
  },
};

const MODULE_DATA: Record<'lectures' | 'materials' | 'library', ModuleDetails> = {
  lectures: {
    moduleKey: 'lectures',
    moduleName: 'Bài Giảng Số',
    title: 'Phân hệ Bài Giảng Số đang trong giai đoạn phát triển',
    badge: 'PHÂN HỆ 02 • ĐÀO TẠO & HUẤN LUYỆN SỐ',
    icon: MonitorPlay,
    features: [
      {
        id: '01',
        title: 'Hệ thống Bài giảng E-Learning',
        description:
          'Chuẩn hóa video huấn luyện, bài giảng đa phương tiện và giáo án điện tử.',
        icon: Video,
      },
      {
        id: '02',
        title: 'Lớp học & Huấn luyện Trực tuyến',
        description:
          'Tổ chức chuyên đề huấn luyện theo từng Khoa, Phòng ban và Tiểu đoàn.',
        icon: Users,
      },
      {
        id: '03',
        title: 'Đánh giá & Theo dõi Tiến độ',
        description:
          'Giám sát kết quả hoàn thành bài giảng của cán bộ, giảng viên và học viên.',
        icon: TrendingUp,
      },
    ],
  },
  materials: {
    moduleKey: 'materials',
    moduleName: 'Học Liệu Số',
    title: 'Phân hệ Học Liệu Số đang trong giai đoạn phát triển',
    badge: 'PHÂN HỆ 03 • KHO HỌC LIỆU QUÂN SỰ',
    icon: Layers,
    features: [
      {
        id: '01',
        title: 'Mô phỏng 3D & Sa bàn Số',
        description:
          'Học liệu trực quan hóa vũ khí, khí tài và mô hình huấn luyện chiến thuật.',
        icon: Box,
      },
      {
        id: '02',
        title: 'Ngân hàng Câu hỏi & Đề thi',
        description:
          'Hệ thống ôn luyện, trắc nghiệm và chuẩn hóa kiến thức quân sự - chính trị.',
        icon: HelpCircle,
      },
      {
        id: '03',
        title: 'Học liệu Chuyên ngành Quân khu',
        description:
          'Kho sơ đồ, bản đồ tác chiến mẫu và tài liệu huấn luyện thực địa.',
        icon: Map,
      },
    ],
  },
  library: {
    moduleKey: 'library',
    moduleName: 'Thư Viện Số',
    title: 'Phân hệ Thư Viện Số đang trong giai đoạn phát triển',
    badge: 'PHÂN HỆ 04 • THƯ VIỆN & ẤN PHẨM SỐ',
    icon: Library,
    features: [
      {
        id: '01',
        title: 'Kho Sách & Giáo trình Quân sự',
        description:
          'Số hóa giáo trình nội bộ, sách chuyên khảo và tài liệu lịch sử Quân khu 7.',
        icon: BookOpen,
      },
      {
        id: '02',
        title: 'Tạp chí & Nghiên cứu Khoa học',
        description:
          'Lưu trữ các công trình nghiên cứu, sáng kiến cải tiến kỹ thuật của Nhà trường.',
        icon: Award,
      },
      {
        id: '03',
        title: 'Phòng Đọc Số Bảo Mật (DRM)',
        description:
          'Khai thác ấn phẩm trực tuyến theo đúng cấp độ bảo mật của quân nhân.',
        icon: ShieldCheck,
      },
    ],
  },
};

function normalizeModule(mod?: EcosystemModuleType): 'lectures' | 'materials' | 'library' {
  const m = (mod || '').toLowerCase().trim();
  if (m.includes('bai-giang') || m.includes('lecture') || m.includes('elearn')) return 'lectures';
  if (m.includes('hoc-lieu') || m.includes('material') || m.includes('saban') || m.includes('3d')) return 'materials';
  if (m.includes('thu-vien') || m.includes('librar') || m.includes('archive') || m.includes('cobalt') || m.includes('blue')) return 'library';
  return 'lectures';
}

export const ModuleUnderDevelopment: React.FC<ModuleUnderDevelopmentProps> = ({
  module,
  moduleType,
  title: customTitle,
  description: customDescription,
  onBack,
}) => {
  const navigate = useNavigate();
  const normalizedKey = normalizeModule(moduleType || module);
  const info = MODULE_DATA[normalizedKey];
  const theme = THEME_CONFIG[normalizedKey];
  const MainIcon = info.icon;

  const handleReturn = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(ROUTE_PATHS.PORTAL);
    }
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto my-4 sm:my-8">
      {/* High-Tech Tactical Ambient Glow (Synchronized per module) */}
      <div
        className={`absolute -inset-1 rounded-3xl bg-gradient-to-r ${theme.ambientGlow} blur-xl opacity-60 dark:opacity-40 pointer-events-none`}
      />

      {/* Main Tactical Command Console Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border ${theme.cardBorder} bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl p-6 sm:p-10 lg:p-12 shadow-2xl transition-colors duration-200`}
      >
        {/* Military Technical Grid Pattern (Tuned to module accent) */}
        <div
          className={`absolute inset-0 ${theme.gridClass} opacity-20 dark:opacity-30 pointer-events-none`}
          aria-hidden="true"
        />

        {/* 4 Corner HUD Crosshairs / Targeting Reticles (⌜, ⌝, ⌞, ⌟) */}
        <div className="absolute top-3 left-3 flex items-start gap-1 pointer-events-none select-none z-20">
          <div className={`w-3.5 h-3.5 border-t-2 border-l-2 ${theme.cornerBorder}`} />
          <span className={`font-mono text-[9px] ${theme.cornerText} font-bold leading-none -mt-0.5 tracking-tighter`}>
            ⌜HUD_01
          </span>
        </div>

        <div className="absolute top-3 right-3 flex items-start gap-1 pointer-events-none select-none z-20">
          <span className={`font-mono text-[9px] ${theme.cornerText} font-bold leading-none -mt-0.5 tracking-tighter`}>
            02_RETICLE⌝
          </span>
          <div className={`w-3.5 h-3.5 border-t-2 border-r-2 ${theme.cornerBorder}`} />
        </div>

        <div className="absolute bottom-3 left-3 flex items-end gap-1 pointer-events-none select-none z-20">
          <div className={`w-3.5 h-3.5 border-b-2 border-l-2 ${theme.cornerBorder}`} />
          <span className={`font-mono text-[9px] ${theme.cornerText} font-bold leading-none -mb-0.5 tracking-tighter`}>
            ⌞SYS_03
          </span>
        </div>

        <div className="absolute bottom-3 right-3 flex items-end gap-1 pointer-events-none select-none z-20">
          <span className={`font-mono text-[9px] ${theme.cornerText} font-bold leading-none -mb-0.5 tracking-tighter`}>
            04_NODE⌟
          </span>
          <div className={`w-3.5 h-3.5 border-b-2 border-r-2 ${theme.cornerBorder}`} />
        </div>

        {/* Top HUD Metadata Bar */}
        <div className="relative z-10 w-full flex items-center justify-between text-[10px] font-mono tracking-widest text-slate-400 dark:text-slate-500 pb-3 mb-6 border-b border-slate-200/80 dark:border-slate-800/80 select-none">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-xs ${theme.statusDot} animate-pulse`} />
            <span className="font-bold text-slate-600 dark:text-slate-300">SYS_NODE_LOC:</span>
            <span className={`font-extrabold ${theme.cornerText}`}>{theme.sysNodeLoc}</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <span>
              ENCRYPTION: <strong className="text-slate-600 dark:text-slate-300">AES-256-GCM</strong>
            </span>
            <span>
              SEC_LEVEL: <strong className="text-slate-600 dark:text-slate-300">ALPHA-01</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>STATUS:</span>
            <span className={`font-extrabold tracking-wider ${theme.cornerText}`}>
              DEPLOYING // PHASE_2
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative z-10 text-center max-w-3xl mx-auto flex flex-col items-center">
          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-2 ${theme.statusBadge} font-mono text-xs px-3.5 py-1.5 rounded-full shadow-xs mb-6 select-none`}
          >
            <span className={`w-2 h-2 rounded-full ${theme.statusDot} animate-pulse`} />
            <span className="font-semibold tracking-wider">
              ĐANG TRONG GIAI ĐOẠN PHÁT TRIỂN • PHASE 2
            </span>
          </div>

          {/* Module Icon Badge */}
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${theme.iconContainer} border flex items-center justify-center shadow-lg mb-6 group transition-transform duration-300 hover:scale-105`}
          >
            <MainIcon className="w-8 h-8 sm:w-10 sm:h-10 transition-transform duration-300 group-hover:scale-110" />
          </div>

          {/* Main Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
            {customTitle || info.title}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
            {customDescription ||
              'Hệ thống đang trong quá trình chuẩn hóa cơ sở dữ liệu, tích hợp API bảo mật và kiểm định an ninh thông tin theo tiêu chuẩn của Trường Quân sự Quân khu 7.'}
          </p>

          {/* CTA Action: Return to Digital Data */}
          <button
            type="button"
            onClick={handleReturn}
            className={`inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl ${theme.ctaButton} font-bold text-xs sm:text-sm border transition-all duration-200 active:scale-95 cursor-pointer select-none`}
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>← Quay về phân hệ Dữ liệu số</span>
          </button>
        </div>

        {/* Feature Blueprint Cards Section */}
        <div className="relative z-10 mt-12 pt-8 border-t border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-5 px-1">
            <div
              className={`flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider ${theme.sectionHeaderColor}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Định hướng tính năng cốt lõi (Feature Blueprints)</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden sm:inline">
              {info.badge}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {info.features.map((feature) => {
              const FeatureIcon = feature.icon;
              return (
                <div
                  key={feature.id}
                  className={`relative group rounded-xl p-5 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 ${theme.featureBorderHover} hover:bg-white dark:hover:bg-slate-800/80 transition-all duration-300 shadow-xs flex flex-col justify-between`}
                >
                  <div>
                    {/* Header: Monospace Number tag & Icon */}
                    <div className="flex items-center justify-between mb-3.5">
                      <div
                        className={`w-9 h-9 rounded-lg border ${theme.featureIconBox} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
                      >
                        <FeatureIcon className="w-4 h-4" />
                      </div>
                      <span className="font-mono tracking-wider tabular-nums text-[10px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700/70 px-2 py-0.5 rounded">
                        MỤC {feature.id}
                      </span>
                    </div>

                    {/* Feature Title */}
                    <h3
                      className={`text-sm font-bold text-slate-900 dark:text-white mb-1.5 ${theme.featureTitleHover} transition-colors`}
                    >
                      {feature.title}
                    </h3>

                    {/* Feature Description */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  {/* High-Tech Status Badge */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    <span>TIẾN ĐỘ TÁC CHIẾN:</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${theme.statusTag}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${theme.statusTagDot} animate-pulse`} />
                      <span>ĐANG CHUẨN HÓA</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security & Standard HUD Footnote */}
        <div className="relative z-10 mt-8 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Shield className={`w-3.5 h-3.5 ${theme.iconColor}`} />
            <span>Tiêu chuẩn bảo mật đa cấp độ Bộ Quốc Phòng & Quân khu 7</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 tracking-wider">
            QK7-DATAHUB // {theme.accentName.toUpperCase()} HUD // SEC_CLASSIFIED
          </span>
        </div>
      </div>
    </div>
  );
};

export default ModuleUnderDevelopment;
