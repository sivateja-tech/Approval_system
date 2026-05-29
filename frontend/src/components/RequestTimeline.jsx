import { formatDateTime } from '../utils/formatters';

const actionIcons = {
  SUBMITTED_FOR_HOD_APPROVAL: '📤',
  SUBMITTED_TO_FINANCE: '📤',
  HOD_APPROVED: '✅',
  HOD_REJECTED: '❌',
  FINANCE_APPROVED: '✅',
  FINANCE_REJECTED: '❌',
  MARKED_NEEDS_REVIEW: '🔄',
};

const actionColors = {
  HOD_APPROVED: 'border-green-400 bg-green-50',
  FINANCE_APPROVED: 'border-green-400 bg-green-50',
  HOD_REJECTED: 'border-red-400 bg-red-50',
  FINANCE_REJECTED: 'border-red-400 bg-red-50',
  MARKED_NEEDS_REVIEW: 'border-orange-400 bg-orange-50',
  SUBMITTED_FOR_HOD_APPROVAL: 'border-blue-400 bg-blue-50',
  SUBMITTED_TO_FINANCE: 'border-blue-400 bg-blue-50',
};

const RequestTimeline = ({ history = [] }) => {
  if (!history.length) return <p className="text-sm text-gray-400 italic">No history yet.</p>;

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
      <div className="space-y-4">
        {history.map((item) => (
          <div key={item.id} className="relative flex gap-4">
            <div className={`z-10 flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm
              ${actionColors[item.action] || 'border-gray-300 bg-white'}`}>
              {actionIcons[item.action] || '•'}
            </div>
            <div className="flex-1 pb-4">
              <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {item.actor?.name}
                      <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.actorRole}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {item.action.replace(/_/g, ' ')}
                    </p>
                    {item.toStatus && (
                      <p className="text-xs text-gray-400 mt-1">
                        Status → <span className="font-medium">{item.toStatus.replace(/_/g, ' ')}</span>
                      </p>
                    )}
                    {item.remarks && (
                      <p className="text-xs text-gray-500 mt-1 italic">"{item.remarks}"</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(item.createdAt)}</p>
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