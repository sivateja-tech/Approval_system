import { formatDateTime } from '../utils/formatters';

const actionIcons = {
  SUBMITTED_FOR_MANAGER_APPROVAL: '📤', // Updated
  SUBMITTED_TO_FINANCE: '📤',
  RESUBMITTED: '🔄',
  MANAGER_APPROVED: '✅',               // Updated
  MANAGER_REJECTED: '❌',               // Updated
  FINANCE_APPROVED: '✅',
  FINANCE_REJECTED: '❌',
  MARKED_NEEDS_REVIEW: '🔄',
  SKIPPED: '⏭️',                         // Added for the new workflow logic
};

const actionColors = {
  RESUBMITTED: 'border-blue-400 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/30', // <--- Added this
  MANAGER_APPROVED: 'border-green-400 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30',
  FINANCE_APPROVED: 'border-green-400 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30',
  MANAGER_REJECTED: 'border-red-400 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30',
  FINANCE_REJECTED: 'border-red-400 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30',
  MARKED_NEEDS_REVIEW: 'border-amber-400 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30',
  SUBMITTED_FOR_MANAGER_APPROVAL: 'border-blue-400 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/30',
  SUBMITTED_TO_FINANCE: 'border-blue-400 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/30',
  SKIPPED: 'border-gray-400 bg-gray-50 dark:bg-gray-500/10 dark:border-gray-500/30',
};

const RequestTimeline = ({ history = [] }) => {
  if (!history.length) return <p className="text-sm text-gray-400 italic">No history yet.</p>;

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-4">
        {history.map((item) => (
          <div key={item.id} className="relative flex gap-4">
            <div className={`z-10 flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm
              ${actionColors[item.action] || 'border-gray-300 bg-white dark:bg-[#1a1d2e] dark:border-gray-600'}`}>
              {actionIcons[item.action] || '•'}
            </div>
            <div className="flex-1 pb-4">
              <div className="bg-white dark:bg-[#1a1d2e] border border-gray-100 dark:border-[#2a2d3e] rounded-lg p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {item.actor?.name || 'System'}
                      </p>
                      {item.actorRole && (
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2a2d3e] px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {item.actorRole}
                        </span>
                      )}
                      {/* Optional: Show the cycle if your backend passes it in metadata */}
                      {item.metadata?.cycle && (
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-100 dark:border-blue-500/20">
                          Cycle {item.metadata.cycle}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 font-medium">
                      {item.action.replace(/_/g, ' ')}
                    </p>
                    {item.toStatus && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Status changed to <span className="font-bold text-gray-600 dark:text-gray-300">{item.toStatus.replace(/_/g, ' ')}</span>
                      </p>
                    )}
                    {item.remarks && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-[#13151f] rounded border border-gray-100 dark:border-[#2a2d3e]">
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic">"{item.remarks}"</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RequestTimeline;