import React from 'react';

interface TastyBitesIconProps {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
}

/**
 * TastyBitesIcon - App logo component for the Tasty Bites Hub system.
 * Circular badge with Hospitality icons (Fork, Knife, Bed) for a Hotel Management System.
 */
const TastyBitesIcon: React.FC<TastyBitesIconProps> = ({
  size = 48,
  primaryColor = "#1a365d", // Navy Blue
  secondaryColor = "#d69e2e", // Gold
  className = ""
}) => {
  return (
    <svg
      width={size}
      height={size * 1.3}
      viewBox="0 0 100 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Tasty Bites Hub"
    >
      <circle cx="50" cy="50" r="48" fill={primaryColor}/>
      {/* Fork and Knife */}
      <path d="M35 25V33C35 36 41 36 41 33V25M38 25V33M38 33V55" stroke={secondaryColor} strokeWidth="3" strokeLinecap="round"/>
      <path d="M55 25V55H62V35C62 28 55 25 55 25Z" fill={secondaryColor}/>
      {/* Bed Icon */}
      <path d="M30 75H70" stroke={secondaryColor} strokeWidth="3" strokeLinecap="round"/>
      <path d="M32 75V60H38V75" fill={secondaryColor}/>
      <path d="M68 75V65H42V75" fill={secondaryColor}/>
      <path d="M45 65V60H65V65" fill={secondaryColor}/>
      <text x="50" y="115" fill={secondaryColor} fontFamily="sans-serif" fontSize="10" fontWeight="bold" textAnchor="middle">Tasty Bites Hub</text>
    </svg>
  );
};

export default TastyBitesIcon;