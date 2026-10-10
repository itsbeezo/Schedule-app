import React from 'react';
import CalendarView from './components/CalendarView';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ToastProvider>
      <CalendarView />
    </ToastProvider>
  );
}
