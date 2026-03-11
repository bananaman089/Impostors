import React from 'react';

export const AmongUsPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`among-us-panel p-6 md:p-8 ${className}`}>
      {children}
    </div>
  );
};
