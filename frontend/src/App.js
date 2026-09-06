import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRoutes from './routes/AppRoutes'; 

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          {/* Toast notifications */}
          <Toaster 
            position="top-right" 
            toastOptions={{
              className: 'dark:bg-[#1a1d2e] dark:text-white',
              style: {
                borderRadius: '12px',
                background: '#fff',
                color: '#333',
              }
            }} 
          />
          
          {/* Main Routing */}
          <AppRoutes />
          
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}