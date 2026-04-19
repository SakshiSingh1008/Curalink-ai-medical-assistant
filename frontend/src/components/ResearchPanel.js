import React, { useState } from 'react';
import './ResearchPanel.css';

export default function ResearchPanel({ data, onClose }) {
  const [activeTab, setActiveTab] = useState('publications');
  const { publications = [], clinicalTrials = [], expandedQuery, query } = data;

  return (
    <aside className="research-panel animate-fadeIn">
      {/* Header */}
      <div className="rp-header">
        <div className="rp-header__left">
          <span className="rp-icon">◈</span>
          <div>
            <div className="rp-title">Research Results</div>
            {expandedQuery && (
              <div className="rp-query" title={expandedQuery}>{expandedQuery}</div>
            )}
          </div>
        </div>
        <button className="rp-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* Tabs */}
      <div className="rp-tabs">
        <button
          className={`rp-tab ${activeTab === 'publications' ? 'rp-tab--active' : ''}`}
          onClick={() => setActiveTab('publications')}
        >
          <span>◈</span>
          Publications
          <span className="rp-tab-count">{publications.length}</span>
        </button>
        <button
          className={`rp-tab ${activeTab === 'trials' ? 'rp-tab--active' : ''}`}
          onClick={() => setActiveTab('trials')}
        >
          <span>⬡</span>
          Clinical Trials
          <span className="rp-tab-count">{clinicalTrials.length}</span>
        </button>
      </div>

      {/* Content */}
      <div className="rp-content">
        {activeTab === 'publications' && (
          <div className="rp-list">
            {publications.length === 0 ? (
              <EmptyState text="No publications found" icon="◈" />
            ) : (
              publications.map((pub, i) => (
                <PublicationCard key={pub.id || i} pub={pub} index={i + 1} />
              ))
            )}
          </div>
        )}

        {activeTab === 'trials' && (
          <div className="rp-list">
            {clinicalTrials.length === 0 ? (
              <EmptyState text="No clinical trials found" icon="⬡" />
            ) : (
              clinicalTrials.map((trial, i) => (
                <TrialCard key={trial.id || i} trial={trial} index={i + 1} />
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function PublicationCard({ pub, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pub-card animate-fadeInUp" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="pub-card__header">
        <div className="pub-index">{index}</div>
        <div className="pub-source-badge" data-source={pub.source}>
          {pub.source}
        </div>
        {pub.openAccess && <span className="oa-badge">Open Access</span>}
      </div>

      <h3 className="pub-title">
        {pub.url ? (
          <a href={pub.url} target="_blank" rel="noopener noreferrer">{pub.title}</a>
        ) : pub.title}
      </h3>

      <div className="pub-meta">
        {pub.authors?.length > 0 && (
          <span className="pub-meta__authors">{pub.authors.slice(0, 3).join(', ')}{pub.authors.length > 3 ? ' et al.' : ''}</span>
        )}
        <span className="pub-meta__sep">·</span>
        <span className="pub-meta__year">{pub.year}</span>
        {pub.journal && (
          <>
            <span className="pub-meta__sep">·</span>
            <span className="pub-meta__journal">{pub.journal}</span>
          </>
        )}
        {pub.citationCount > 0 && (
          <>
            <span className="pub-meta__sep">·</span>
            <span className="pub-meta__citations">⬆ {pub.citationCount} citations</span>
          </>
        )}
      </div>

      {pub.abstract && (
        <>
          <p className={`pub-abstract ${expanded ? 'pub-abstract--expanded' : ''}`}>
            {pub.abstract}
          </p>
          <button className="pub-expand-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▲ Show less' : '▼ Read abstract'}
          </button>
        </>
      )}

      {pub.url && (
        <a href={pub.url} target="_blank" rel="noopener noreferrer" className="pub-link">
          View on {pub.source} ↗
        </a>
      )}
    </div>
  );
}

function TrialCard({ trial, index }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    RECRUITING: 'var(--accent-green)',
    COMPLETED: 'var(--accent-blue)',
    ACTIVE_NOT_RECRUITING: 'var(--accent-amber)',
    TERMINATED: 'var(--accent-rose)',
    WITHDRAWN: 'var(--text-muted)',
    UNKNOWN: 'var(--text-muted)',
  };

  const statusColor = statusColors[trial.status] || 'var(--text-muted)';

  return (
    <div className="trial-card animate-fadeInUp" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="trial-card__header">
        <div className="pub-index">{index}</div>
        <div className="trial-status" style={{ '--status-color': statusColor }}>
          <span className="trial-status__dot" />
          {trial.status?.replace(/_/g, ' ')}
        </div>
        {trial.phase && trial.phase !== 'N/A' && (
          <span className="trial-phase">{trial.phase}</span>
        )}
      </div>

      <h3 className="pub-title">
        {trial.url ? (
          <a href={trial.url} target="_blank" rel="noopener noreferrer">{trial.title}</a>
        ) : trial.title}
      </h3>

      <div className="pub-meta">
        <span className="pub-meta__authors">{trial.nctId}</span>
        {trial.sponsor && trial.sponsor !== 'N/A' && (
          <>
            <span className="pub-meta__sep">·</span>
            <span className="pub-meta__journal">{trial.sponsor}</span>
          </>
        )}
      </div>

      {trial.brief && (
        <p className={`pub-abstract ${expanded ? 'pub-abstract--expanded' : ''}`}>
          {trial.brief}
        </p>
      )}

      {expanded && (
        <div className="trial-details">
          {/* Dates */}
          <div className="trial-detail-row">
            <span className="td-label">Start</span>
            <span className="td-value">{trial.startDate}</span>
            <span className="td-label">Est. Completion</span>
            <span className="td-value">{trial.completionDate}</span>
          </div>

          {/* Eligibility */}
          {trial.eligibility && (
            <div className="trial-eligibility">
              <div className="td-label">Eligibility Criteria</div>
              <div className="td-eligibility-text">{trial.eligibility}</div>
            </div>
          )}

          {/* Locations */}
          {trial.locations?.length > 0 && (
            <div className="trial-locations">
              <div className="td-label">Locations</div>
              {trial.locations.map((loc, i) => (
                <div key={i} className="trial-loc-item">
                  <span>◇</span>
                  {[loc.facility, loc.city, loc.country].filter(Boolean).join(', ')}
                </div>
              ))}
            </div>
          )}

          {/* Contacts */}
          {trial.contacts?.length > 0 && (
            <div className="trial-contacts">
              <div className="td-label">Contacts</div>
              {trial.contacts.map((c, i) => (
                <div key={i} className="trial-contact-item">
                  <span className="contact-name">{c.name}</span>
                  {c.email && <a href={`mailto:${c.email}`} className="contact-email">{c.email}</a>}
                  {c.phone && <span className="contact-phone">{c.phone}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="pub-expand-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▲ Show less' : '▼ View details & eligibility'}
      </button>

      {trial.url && (
        <a href={trial.url} target="_blank" rel="noopener noreferrer" className="pub-link pub-link--trial">
          View on ClinicalTrials.gov ↗
        </a>
      )}
    </div>
  );
}

function EmptyState({ text, icon }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
