import React from 'react';
import { motion } from 'framer-motion';
import { TOUCHID_GRAY_BASE64, TOUCHID_RED_BASE64 } from './touchid_assets';

export interface TouchIDFingerprintProps {
  progress?: number; // 0 to 100
  phase?: 'idle' | 'scanning' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TouchIDFingerprint: React.FC<TouchIDFingerprintProps> = ({
  progress: customProgress,
  phase = 'scanning',
  size = 'md',
  className = '',
}) => {
  // Determine progress percentage based on phase or prop
  let progress = customProgress !== undefined ? customProgress : 0;
  if (customProgress === undefined) {
    if (phase === 'success') progress = 100;
    else if (phase === 'scanning') progress = 50;
    else if (phase === 'idle') progress = 0;
  }

  // Dimensions based on authentic fingerprint aspect ratio 137:223 (~1.63)
  const sizeMap = {
    sm: { width: 110, height: 179 },
    md: { width: 138, height: 224 },
    lg: { width: 168, height: 274 },
  };
  const { width, height } = sizeMap[size];

  // Smooth mask calculation centered on the core whorl at (51.5%, 49.3%)
  const isFullRed = phase === 'success' || progress >= 96;
  const isZeroRed = phase === 'idle' || progress <= 0;

  // Mask gradient expanding elliptically from the inner core
  const innerStop = Math.max(0, Math.round(progress - 10));
  const outerStop = Math.min(100, Math.round(progress + 16));

  const maskStyle: React.CSSProperties = isFullRed
    ? {
        WebkitMaskImage: 'none',
        maskImage: 'none',
        opacity: 1,
      }
    : isZeroRed
    ? {
        opacity: 0,
      }
    : {
        WebkitMaskImage: `radial-gradient(ellipse at 51.5% 49.3%, black 0%, black ${innerStop}%, transparent ${outerStop}%)`,
        maskImage: `radial-gradient(ellipse at 51.5% 49.3%, black 0%, black ${innerStop}%, transparent ${outerStop}%)`,
        opacity: 1,
      };

  return (
    <div
      className={`relative mx-auto flex items-center justify-center select-none ${className}`}
      style={{ width, height }}
    >
      {/* Error shake / Success micro-bounce container */}
      <motion.div
        animate={
          phase === 'error'
            ? { x: [-8, 8, -6, 6, -3, 3, 0] }
            : phase === 'success'
            ? { scale: [1, 1.04, 1] }
            : {}
        }
        transition={{ duration: phase === 'error' ? 0.45 : 0.6, ease: 'easeOut' }}
        className="relative w-full h-full flex items-center justify-center"
      >
        {/* Layer 1: Gray Ridges (Base Un-scanned State) */}
        <img
          src={TOUCHID_GRAY_BASE64}
          alt="Touch ID Unscanned"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          draggable={false}
        />

        {/* Layer 2: Red Ridges (Touch ID Progressive Fill & Glow) */}
        <div
          style={{
            ...maskStyle,
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            filter:
              phase === 'success'
                ? 'drop-shadow(0 0 10px rgba(255, 45, 85, 0.55))'
                : 'none',
          }}
          className="absolute inset-0 w-full h-full"
        >
          <img
            src={TOUCHID_RED_BASE64}
            alt="Touch ID Active"
            className="w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
          />
        </div>
      </motion.div>
    </div>
  );
};
