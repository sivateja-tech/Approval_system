const EmptyState = ({ title = 'Nothing here', message = '', icon = '📭' }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
    {message && <p className="text-sm text-gray-400 mt-1">{message}</p>}
  </div>
);
export default EmptyState;