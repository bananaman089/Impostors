import React from 'react';

export const AmongUsInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
  return (
    <input 
      className={`among-us-input px-4 py-3 text-lg w-full text-black focus:outline-none focus:ring-4 focus:ring-blue-400 ${className}`}
      {...props}
    />
  );
};
