import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ToastApi {
  showError(message: string): void;
}

const ToastContext = createContext<ToastApi>({ showError: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showError = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showError }}>
      {children}
      {message && (
        <div className="toast toast--error" role="alert">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
