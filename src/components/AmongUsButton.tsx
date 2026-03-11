import React from 'react';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'success' | 'secondary';
}

export const AmongUsButton: React.FC<Props> = ({ children, variant = 'primary', className = '', ...props }) => {
  let bgClass = 'bg-gray-200 text-black border-gray-400';
  if (variant === 'primary') bgClass = 'bg-gray-200 text-black border-gray-400';
  if (variant === 'danger') bgClass = 'bg-gray-200 text-black border-gray-400';
  if (variant === 'success') bgClass = 'bg-gray-200 text-black border-gray-400';
  if (variant === 'secondary') bgClass = 'bg-gray-100 text-black border-gray-300';

  return (
    <button 
      className={`among-us-button px-6 py-3 text-lg md:text-xl ${bgClass} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
      {...props}
    >
      {children}
    </button>
  );
};
