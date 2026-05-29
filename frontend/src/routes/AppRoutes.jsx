import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Register from '../pages/auth/Register';
import Login from '../pages/auth/Login';
import Dashboard from '../pages/user/Dashboard';
import MyRequests from '../pages/user/MyRequests';
import CreateRequest from '../pages/user/CreateRequest';
import RequestDetails from '../pages/user/RequestDetails';
import EditRequest from '../pages/user/EditRequest';

import HODDashboard from '../pages/hod/HODDashboard';
import PendingApprovals from '../pages/hod/PendingApprovals';
import ApprovalHistory from '../pages/hod/ApprovalHistory';   // ← separate component
import ApprovalDetails from '../pages/hod/ApprovalDetails';

import FinanceDashboard from '../pages/finance/FinanceDashboard';
import FinanceQueue from '../pages/finance/FinanceQueue';
import FinanceReviewDetails from '../pages/finance/FinanceReviewDetails';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
};

const RoleHome = () => {
  const { user } = useAuth();
  if (user?.role === 'HOD')     return <Navigate to="/hod/dashboard" replace />;
  if (user?.role === 'FINANCE') return <Navigate to="/finance/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
};

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />

      {/* USER */}
      <Route path="/dashboard"
        element={<ProtectedRoute roles={['USER']}><Dashboard /></ProtectedRoute>} />
      <Route path="/requests"
        element={<ProtectedRoute roles={['USER']}><MyRequests /></ProtectedRoute>} />
      <Route path="/requests/new"
        element={<ProtectedRoute roles={['USER']}><CreateRequest /></ProtectedRoute>} />
      <Route path="/requests/:id"
        element={<ProtectedRoute roles={['USER']}><RequestDetails /></ProtectedRoute>} />
      <Route path="/requests/:id/edit"
        element={<ProtectedRoute roles={['USER']}><EditRequest /></ProtectedRoute>} />

      {/* HOD */}
      <Route path="/hod/dashboard"
        element={<ProtectedRoute roles={['HOD']}><HODDashboard /></ProtectedRoute>} />
      <Route path="/hod/approvals"
        element={<ProtectedRoute roles={['HOD']}><PendingApprovals /></ProtectedRoute>} />
      <Route path="/hod/history"
        element={<ProtectedRoute roles={['HOD']}><ApprovalHistory /></ProtectedRoute>} />  {/* ← FIXED */}
      <Route path="/hod/requests/:id"
        element={<ProtectedRoute roles={['HOD']}><ApprovalDetails /></ProtectedRoute>} />

      {/* FINANCE */}
      <Route path="/finance/dashboard"
        element={<ProtectedRoute roles={['FINANCE']}><FinanceDashboard /></ProtectedRoute>} />
      <Route path="/finance/queue"
        element={<ProtectedRoute roles={['FINANCE']}><FinanceQueue /></ProtectedRoute>} />
      <Route path="/finance/requests/:id"
        element={<ProtectedRoute roles={['FINANCE']}><FinanceReviewDetails /></ProtectedRoute>} />

      <Route path="/" element={<ProtectedRoute><RoleHome /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}