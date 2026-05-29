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

// Map every status your backend can return
export const statusColors = {
  DRAFT:                    'bg-gray-100   text-gray-600',
  SUBMITTED:                'bg-blue-100   text-blue-700',
  PENDING_HOD_APPROVAL:     'bg-yellow-100 text-yellow-700',
  HOD_APPROVED:             'bg-teal-100   text-teal-700',
  PENDING_FINANCE_APPROVAL: 'bg-purple-100 text-purple-700',
  FINANCE_APPROVED:         'bg-green-100  text-green-700',
  FINANCE_REJECTED:         'bg-red-100    text-red-700',
  NEEDS_REVIEW:             'bg-orange-100 text-orange-700',
  RESUBMITTED:              'bg-blue-100   text-blue-700',
  CANCELLED:                'bg-gray-100   text-gray-400',
  FINAL_REJECTED:           'bg-red-100    text-red-700',
};

export const statusLabel = {
  DRAFT:                    'Draft',
  SUBMITTED:                'Submitted',
  PENDING_HOD_APPROVAL:     'Pending HOD',
  HOD_APPROVED:             'HOD Approved',
  PENDING_FINANCE_APPROVAL: 'Pending Finance',
  FINANCE_APPROVED:         '✓ Approved',
  FINANCE_REJECTED:         '✗ Rejected',
  NEEDS_REVIEW:             'Needs Review',
  RESUBMITTED:              'Resubmitted',
  CANCELLED:                'Cancelled',
  FINAL_REJECTED:           '✗ Final Rejected',
};
// Add to existing formatters.js
export const IN_PROGRESS_STATUSES = [
  'SUBMITTED',
  'PENDING_HOD_APPROVAL',
  'HOD_APPROVED',
  'PENDING_FINANCE_APPROVAL',
  'RESUBMITTED',
];

// Find the step that was rejected — used in RequestDetails
export const getRejectedStep = (approvalSteps = []) =>
  approvalSteps.find((s) => s.status === 'REJECTED') || null;