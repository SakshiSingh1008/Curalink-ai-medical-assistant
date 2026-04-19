import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import ResearchPanel from './ResearchPanel';
import PatientContextModal from './PatientContextModal';
import { useSession } from '../context/SessionContext';
import './MainLayout.css';

export default function MainLayout() {
  const { messages } = useSession();
  const [showContext, setShowContext] = useState(false);
  const [activeResearch, setActiveResearch] = useState(null); // { publications, clinicalTrials }
  const [researchPanelOpen, setResearchPanelOpen] = useState(false);

  const handleResearchUpdate = (data) => {
    setActiveResearch(data);
    setResearchPanelOpen(true);
  };

  return (
    <div className="app-shell">
      {/* Background grid */}
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />

      <Sidebar onOpenContext={() => setShowContext(true)} />

      <div className="main-area">
        <ChatPanel onResearchUpdate={handleResearchUpdate} />
      </div>

      {researchPanelOpen && activeResearch && (
        <ResearchPanel
          data={activeResearch}
          onClose={() => setResearchPanelOpen(false)}
        />
      )}

      {showContext && (
        <PatientContextModal onClose={() => setShowContext(false)} />
      )}
    </div>
  );
}
