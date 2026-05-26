import React from 'react';

// Crisp, high-fidelity Forklift Icon
export const ForkliftIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" className={className}>
    {/* Forklift chassis */}
    <path d="M10 65 h40 l10 -15 h15 v12 h-10 v15 h-55 z" className="text-[#0c2340]" />
    {/* Mast and cage structure */}
    <rect x="68" y="25" width="4" height="48" rx="1" className="text-[#0c2340]" />
    <rect x="72" y="32" width="2" height="41" rx="0.5" className="text-gray-400" />
    {/* Cabin bars */}
    <path d="M22 62 l6 -28 h18 l10 28 h-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#0c2340]" />
    {/* Overhead guard */}
    <rect x="25" y="30" width="22" height="4" rx="1" className="text-[#0c2340]" />
    <line x1="33" y1="34" x2="33" y2="62" stroke="currentColor" strokeWidth="2.5" className="text-[#0c2340]" />
    <line x1="41" y1="34" x2="41" y2="62" stroke="currentColor" strokeWidth="2.5" className="text-[#0c2340]" />
    {/* Operator seat */}
    <path d="M25 54 h8 v8 h-8 z" className="text-gray-600" />
    {/* Fork carriage and tines */}
    <path d="M72 50 h18 v4 h-18 z" className="text-[#f95700]" />
    <path d="M84 54 v15 h10 v3 h-14 v-18 z" className="text-[#f95700]" />
    {/* Wheels */}
    <circle cx="21" cy="72" r="11" fill="#000" />
    <circle cx="21" cy="72" r="4" fill="#fff" />
    <circle cx="56" cy="72" r="11" fill="#000" />
    <circle cx="56" cy="72" r="4" fill="#fff" />
    {/* Steering Wheel and Controls */}
    <path d="M48 48 l-5 6 m2 -4 h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#0c2340]" />
  </svg>
);

// High-fidelity graphic watermark of a forklift used inside the card background
export const ForkliftWatermark: React.FC<{ className?: string }> = ({ className = "absolute inset-0 opacity-5" }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" className={className}>
    <path d="M5 65 h40 l10 -15 h15 v12 h-10 v15 h-55 z" />
    <rect x="63" y="25" width="4" height="48" rx="1" />
    <path d="M17 62 l6 -28 h18 l10 28" fill="none" stroke="currentColor" strokeWidth="3" />
    <circle cx="16" cy="72" r="11" />
    <circle cx="51" cy="72" r="11" />
    <path d="M67 50 h22 v4 h-22 z" />
    <path d="M79 54 v15 h10 v3 h-14 v-18 z" />
  </svg>
);

// Mini Icons for each detail card row matching the layouts
export const NicIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11h3m-3 4h3m-9-1a3 3 0 0 1 6 0" />
  </svg>
);

export const NameIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export const IdIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

export const GradeIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

export const CourseIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 14l9-5-9-5-9 5 9 5z" />
    <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
);

export const CalendarIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const CenterIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

export const CheckShieldIcon = ({ className = "w-5 h-5 text-[#f95700]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
