import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/UI/LoadingSpinner';

// Auth

import Login from '../pages/auth/Login';

// User
import Dashboard from '../pages/user/Dashboard';
import MyRequests from '../pages/user/MyRequests';
import CreateRequest from '../pages/user/CreateRequest';
import RequestDetails from '../pages/user/RequestDetails';
import EditRequest from '../pages/user/EditRequest';

// Manager (Formerly HOD)
import ManagerDashboard from '../pages/manager/ManagerDashboard';
import PendingApprovals from '../pages/manager/PendingApprovals';
import ApprovalHistory from '../pages/manager/ApprovalHistory';
import ApprovalDetails from '../pages/manager/ApprovalDetails';

// Finance
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
  if (user?.role === 'MANAGER') return <Navigate to="/manager/dashboard" replace />;
  if (user?.role === 'FINANCE') return <Navigate to="/finance/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
};

export default function AppRoutes() {
  return (
    <Routes>
      
      <Route path="/login" element={<Login />} />
      {/* Both Users and Managers should be allowed to access this component */}
    
    

      {/* USER */}
      <Route path="/dashboard"
        element={<ProtectedRoute roles={['USER']}><Dashboard /></ProtectedRoute>} />
      <Route path="/requests"
        element={<ProtectedRoute roles={['USER','MANAGER']}><MyRequests /></ProtectedRoute>} />
      <Route path="/requests/new"
        element={<ProtectedRoute roles={['USER','MANAGER']}><CreateRequest /></ProtectedRoute>} />
      <Route path="/requests/:id"
        element={<ProtectedRoute roles={['USER','MANAGER']}><RequestDetails /></ProtectedRoute>} />
      <Route path="/requests/:id/edit"
        element={<ProtectedRoute roles={['USER','MANAGER']}><EditRequest /></ProtectedRoute>} />

      {/* MANAGER */}
      <Route path="/manager/dashboard"
        element={<ProtectedRoute roles={['MANAGER']}><ManagerDashboard /></ProtectedRoute>} />
      <Route path="/manager/approvals"
        element={<ProtectedRoute roles={['MANAGER']}><PendingApprovals /></ProtectedRoute>} />
      <Route path="/manager/history"
        element={<ProtectedRoute roles={['MANAGER']}><ApprovalHistory /></ProtectedRoute>} />
      <Route path="/manager/requests/:id"
        element={<ProtectedRoute roles={['MANAGER']}><ApprovalDetails /></ProtectedRoute>} />

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