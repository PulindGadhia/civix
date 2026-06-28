import React from 'react';

interface LogoProps {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'navbar';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  logoClassName = '',
  textClassName = '',
  size = 'md'
}) => {
  const sizeMap = {
    sm: 'text-sm tracking-wider',
    md: 'text-lg tracking-widest',
    lg: 'text-5xl md:text-6xl tracking-[0.2em] font-extrabold',
    navbar: 'text-lg md:text-xl tracking-widest'
  };

  const activeSize = sizeMap[size];

  // Since we only display the stylized name, ignore showText and render the wordmark
  return (
    <div className={`flex items-center select-none ${className}`}>
      <span className={`font-sans font-black bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500 bg-clip-text text-transparent uppercase ${activeSize} ${textClassName} ${logoClassName}`}>
        CiviX
      </span>
    </div>
  );
};
