import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { healthAPI } from '../utils/api';
import './Sidebar.css';

const NAV_ITEMS = [
  { icon: '⬡', label: 'Research', key: 'research' },
  { icon: '◈', label: 'Trials', key: 'trials' },
  { icon: '◎', label: 'History', key: 'history' },
];

export default function Sidebar({ onOpenContext }) {
  const { patientContext, clearSession } = useSession();
  const [health, setHealth] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('research');

  useEffect(() => {
    healthAPI.check()
      .then(r => setHealth(r.data))
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  const { patientName, disease, location } = patientContext;

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="logo-mark">
          <span className="logo-cross">✛</span>
        </div>
        {!collapsed && (
          <div className="logo-text">
            <span className="logo-name">Curalink</span>
            <span className="logo-tagline">Medical AI</span>
          </div>
        )}
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Patient Card */}
      {!collapsed && (
        <div className="patient-card" onClick={onOpenContext}>
          <div className="patient-card__header">
            <span className="patient-icon">◉</span>
            <span className="patient-card__label">Patient Context</span>
            <span className="edit-icon">✎</span>
          </div>
          <div className="patient-card__body">
            {patientName ? (
              <>
                <div className="patient-name">{patientName}</div>
                {disease && <div className="patient-detail"><span className="detail-dot">◆</span>{disease}</div>}
                {location && <div className="patient-detail"><span className="detail-dot">◇</span>{location}</div>}
              </>
            ) : (
              <div className="patient-empty">Click to set patient context</div>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`nav-item ${active === item.key ? 'nav-item--active' : ''}`}
            onClick={() => setActive(item.key)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        {/* Status */}
        {!collapsed && health && (
          <div className="status-panel">
            <div className="status-title">System Status</div>
            {Object.entries(health.checks || {}).map(([k, v]) => (
              <div key={k} className="status-row">
                <span className={`status-dot ${v === 'ok' ? 'status-dot--ok' : 'status-dot--err'}`} />
                <span className="status-key">{k}</span>
                <span className={`status-val ${v === 'ok' ? 'ok' : 'err'}`}>{v}</span>
              </div>
            ))}
            {health.model && <div className="status-model">Model: {health.model}</div>}
          </div>
        )}

        {/* Clear */}
        <button className="clear-btn" onClick={clearSession} title="New Session">
          <span>↺</span>
          {!collapsed && <span>New Session</span>}
        </button>
      </div>
    </aside>
  );
}
