// src/styles/theme.js
// ── Unified light/dark theme with orange primary ─────────────────────────

// Base surfaces
export const bg    = 'bg-white dark:bg-[#0f1117]';
export const surf  = 'bg-white dark:bg-[#13151f]';
export const surf2 = 'bg-amber-50 dark:bg-[#1a1d2e]';
export const surf3 = 'bg-gray-50 dark:bg-[#1e2235]';
export const bord  = 'border-amber-100 dark:border-[#1e2235]';
export const bord2 = 'border-amber-200 dark:border-[#2a2d3e]';


// Text
export const txt   = 'text-gray-900 dark:text-white';
export const txt2  = 'text-gray-500 dark:text-gray-400';
export const txt3  = 'text-gray-400 dark:text-gray-600';

// Card
export const card  = `bg-white dark:bg-[#13151f] border border-amber-100 dark:border-[#1e2235] rounded-2xl`;
export const card2 = `bg-amber-50 dark:bg-[#1a1d2e] border border-amber-100 dark:border-[#2a2d3e] rounded-2xl`;

// Input
export const inp = [
  'w-full rounded-xl px-4 py-2.5 text-sm transition-all',
  'bg-white dark:bg-[#1a1d2e]',
  'border border-amber-200 dark:border-[#2a2d3e]',
  'text-gray-900 dark:text-gray-100',
  'placeholder-gray-400 dark:placeholder-gray-600',
  'focus:outline-none focus:ring-2 focus:ring-amber-400/40 dark:focus:ring-amber-500/30',
  'focus:border-amber-400 dark:focus:border-amber-500/60',
].join(' ');

// Primary button
export const btnPrimary = [
  'bg-amber-500 hover:bg-amber-600 active:bg-amber-700',
  'text-white font-bold rounded-xl transition-all',
  'shadow-lg shadow-amber-500/20 dark:shadow-amber-500/10',
  'hover:scale-[1.02] active:scale-[0.99]',
].join(' ');

// Secondary button
export const btnSecondary = [
  'border border-amber-200 dark:border-[#2a2d3e]',
  'text-gray-600 dark:text-gray-400',
  'hover:bg-amber-50 dark:hover:bg-[#1a1d2e]',
  'rounded-xl transition-all font-semibold',
].join(' ');

// Status styles
export const STATUS = {
  pending:   { bg: 'bg-amber-50  dark:bg-amber-500/10',  border: 'border-amber-200  dark:border-amber-500/20',  text: 'text-amber-600  dark:text-amber-400',  dot: 'bg-amber-500'  },
  approved:  { bg: 'bg-green-50  dark:bg-green-500/10',  border: 'border-green-200  dark:border-green-500/20',  text: 'text-green-600  dark:text-green-400',  dot: 'bg-green-500'  },
  rejected:  { bg: 'bg-red-50    dark:bg-red-500/10',    border: 'border-red-200    dark:border-red-500/20',    text: 'text-red-600    dark:text-red-400',    dot: 'bg-red-500'    },
  review:    { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  waiting:   { bg: 'bg-gray-50   dark:bg-gray-800/30',   border: 'border-gray-200   dark:border-gray-700/40',   text: 'text-gray-500   dark:text-gray-500',   dot: 'bg-gray-300 dark:bg-gray-600' },
  draft:     { bg: 'bg-gray-50   dark:bg-gray-800/20',   border: 'border-gray-200   dark:border-gray-700',      text: 'text-gray-500   dark:text-gray-400',   dot: 'bg-gray-400' },
};