import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFinanceQueue } from '../../api/finance.api';
import Layout from '../../components/Layout/Layout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import EmptyState from '../../components/UI/EmptyState';
import StatusBadge from '../../components/UI/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';

const FinanceQueue = () => {
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFinanceQueue({ page: 1, limit: 20 })
      .then((r) => { setRequests(r.data.data); setTotal(r.data.pagination.total); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Finance Review Queue</h1>
          <p className="text-gray-500 text-sm">{total} request(s) pending financial review</p>
        </div>

        {loading ? <LoadingSpinner /> : requests.length === 0 ? (
          <EmptyState title="Queue is empty" message="No requests pending finance review." icon="✅" />
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Link key={req.id} to={`/finance/requests/${req.id}`}
                className="block bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{req.title}</p>
                    <p className="text-xs text-gray-400">{req.requestNumber} · by {req.createdBy.name} · {req.createdBy.department?.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{req.description?.slice(0, 100)}...</p>
                    {req.approvalSteps?.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        ✅ HOD chain completed ({req.approvalSteps.filter((s) => s.status === 'APPROVED').length}/{req.approvalSteps.length} approved)
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(req.amount)}</p>
                    <p className="text-xs text-gray-400">{formatDate(req.createdAt)}</p>
                    <div className="mt-1"><StatusBadge status={req.status} /></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FinanceQueue;