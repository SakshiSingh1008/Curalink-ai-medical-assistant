import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('curalink_session');
    if (stored) return stored;
    const id = uuidv4();
    localStorage.setItem('curalink_session', id);
    return id;
  });

  const [patientContext, setPatientContext] = useState({
    patientName: localStorage.getItem('curalink_name') || '',
    disease: localStorage.getItem('curalink_disease') || '',
    location: localStorage.getItem('curalink_location') || '',
  });

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const updateContext = useCallback((updates) => {
    setPatientContext(prev => {
      const next = { ...prev, ...updates };
      if (updates.patientName !== undefined) localStorage.setItem('curalink_name', updates.patientName);
      if (updates.disease !== undefined) localStorage.setItem('curalink_disease', updates.disease);
      if (updates.location !== undefined) localStorage.setItem('curalink_location', updates.location);
      return next;
    });
  }, []);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { ...msg, id: uuidv4(), timestamp: new Date() }]);
  }, []);

  const clearSession = useCallback(() => {
    setMessages([]);
    const newId = uuidv4();
    localStorage.setItem('curalink_session', newId);
    window.location.reload();
  }, []);

  return (
    <SessionContext.Provider value={{
      sessionId,
      patientContext,
      updateContext,
      messages,
      addMessage,
      setMessages,
      isLoading,
      setIsLoading,
      clearSession,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
};
