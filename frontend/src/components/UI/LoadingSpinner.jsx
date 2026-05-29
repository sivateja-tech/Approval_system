const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
    <p className="text-sm text-gray-500">{message}</p>
  </div>
);
export default LoadingSpinner;