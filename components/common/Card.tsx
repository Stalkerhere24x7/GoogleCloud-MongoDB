
import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', titleClassName = '' }) => {
  return (
    <div className={`bg-white shadow-lg rounded-xl p-6 ${className}`}>
      {title && (
        <h2 className={`text-xl font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200 ${titleClassName}`}>
          {title}
        </h2>
      )}
      {children}
    </div>
  );
};

export default Card;
