import React from 'react';
import { SessionProvider } from './context/SessionContext';
import MainLayout from './components/MainLayout';

export default function App() {
  return (
    <SessionProvider>
      <MainLayout />
    </SessionProvider>
  );
}
