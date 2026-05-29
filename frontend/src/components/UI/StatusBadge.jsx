const STATUS_MAP = {
  DRAFT:                    { label: 'Draft',           cls: 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'       },
  PENDING_HOD_APPROVAL:     { label: 'Pending HOD',     cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' },
  HOD_APPROVED:             { label: 'HOD Approved',    cls: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/20'       },
  PENDING_FINANCE_APPROVAL: { label: 'Pending Finance', cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'       },
  FINANCE_APPROVED:         { label: '✓ Approved',      cls: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20' },
  FINANCE_REJECTED:         { label: '✕ Rejected',      cls: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'             },
  NEEDS_REVIEW:             { label: 'Needs Review',    cls: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' },
  CANCELLED:                { label: 'Cancelled',       cls: 'bg-gray-100 dark:bg-gray-800/40 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700'         },
  RESUBMITTED:              { label: 'Resubmitted',     cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'       },
};

const StatusBadge = ({ status }) => {
  const map = STATUS_MAP[status] || { label: status, cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${map.cls}`}>
      {map.label}
    </span>
  );
};

export default StatusBadge;