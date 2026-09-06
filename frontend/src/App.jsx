export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

export const formatDateTime = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// Map every status your backend can return with full dark-mode support
export const statusColors = {
  DRAFT:                    'bg-gray-100   dark:bg-gray-800/50     text-gray-600   dark:text-gray-400',
  SUBMITTED:                'bg-blue-100   dark:bg-blue-500/20     text-blue-700   dark:text-blue-400',
  PENDING_MANAGER_APPROVAL: 'bg-purple-100 dark:bg-purple-500/20   text-purple-700 dark:text-purple-400',
  MANAGER_APPROVED:         'bg-teal-100   dark:bg-teal-500/20     text-teal-700   dark:text-teal-400',
  PENDING_FINANCE_APPROVAL: 'bg-amber-100  dark:bg-amber-500/20    text-amber-700  dark:text-amber-400',
  FINANCE_APPROVED:         'bg-green-100  dark:bg-green-500/20    text-green-700  dark:text-green-400',
  FINANCE_REJECTED:         'bg-red-100    dark:bg-red-500/20      text-red-700    dark:text-red-400',
  NEEDS_REVIEW:             'bg-amber-100 dark:bg-amber-500/20   text-amber-700 dark:text-amber-400',
  REJECTED:                 'bg-red-100    dark:bg-red-500/20      text-red-700    dark:text-red-400',
  RESUBMITTED:              'bg-blue-100   dark:bg-blue-500/20     text-blue-700   dark:text-blue-400',
  CANCELLED:                'bg-gray-100   dark:bg-gray-800/30     text-gray-400   dark:text-gray-500',
};

// Clean UI labels for the new hierarchy
export const statusLabel = {
  DRAFT:                    'Draft',
  SUBMITTED:                'Submitted',
  PENDING_MANAGER_APPROVAL: 'Pending Manager',
  MANAGER_APPROVED:         'Manager Approved',
  PENDING_FINANCE_APPROVAL: 'Pending Finance',
  FINANCE_APPROVED:         '✓ Approved',
  FINANCE_REJECTED:         '✕ Rejected (Closed)',
  NEEDS_REVIEW:             'Needs Review',
  REJECTED:                 'Returned by Manager',
  RESUBMITTED:              'Resubmitted',
  CANCELLED:                'Cancelled',
};

// Centralized array of statuses considered active/in-flight
export const IN_PROGRESS_STATUSES = [
  'SUBMITTED',
  'PENDING_MANAGER_APPROVAL',
  'MANAGER_APPROVED',
  'PENDING_FINANCE_APPROVAL',
  'RESUBMITTED',
];

// Find the step that was rejected — used in RequestDetails and timelines
export const getRejectedStep = (approvalSteps = []) =>
  approvalSteps.find((s) => s.status === 'REJECTED') || null;