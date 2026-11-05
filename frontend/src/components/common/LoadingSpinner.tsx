import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LoadingSpinnerProps {
  tip?: string;
  size?: 'small' | 'default' | 'large';
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  tip = 'Đang tải dữ liệu...',
  size = 'large',
  fullScreen = false,
}) => {
  const antIcon = <LoadingOutlined style={{ fontSize: size === 'large' ? 36 : 24, color: '#722ED1' }} spin />;

  const content = (
    <div className="flex flex-col items-center justify-center gap-3 p-6">
      <Spin indicator={antIcon} size={size} />
      {tip && (
        <span className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 animate-pulse">
          {tip}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-[#090e17]/80 backdrop-blur-sm transition-all">
        {content}
      </div>
    );
  }

  return <div className="flex items-center justify-center w-full min-h-[200px]">{content}</div>;
};

export default LoadingSpinner;

