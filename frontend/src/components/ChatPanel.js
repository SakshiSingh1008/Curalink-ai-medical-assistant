import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSession } from '../context/SessionContext';
import { useStreamingChat } from '../hooks/useStreamingChat';
import './ChatPanel.css';

const SUGGESTIONS = [
  'Latest treatment for lung cancer',
  'Clinical trials for Parkinson\'s disease',
  'Deep brain stimulation outcomes',
  'Alzheimer\'s disease prevention research',
  'Heart disease recent clinical trials',
  'Diabetes management new studies',
];

export default function ChatPanel({ onResearchUpdate }) {
  const { sessionId, patientContext, messages, addMessage } = useSession();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const { send, isLoading, streamingText, phase } = useStreamingChat({
    sessionId,
    patientContext,
    addMessage,
    onResearchUpdate,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isLoading]);

  const handleSubmit = (query = input.trim()) => {
    if (!query || isLoading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    send(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
    setInput(e.target.value);
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header__left">
          <div className={`chat-status-dot ${isLoading ? 'chat-status-dot--pulsing' : ''}`} />
          <span className="chat-header__title">Research Session</span>
          {patientContext.disease && <span className="disease-pill">{patientContext.disease}</span>}
        </div>
        <div className="chat-header__right">
          {isLoading && <span className="phase-label">{phaseLabel(phase)}</span>}
          <span className="chat-session-id">#{sessionId.slice(0, 8)}</span>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !isLoading
          ? <WelcomeScreen onSuggest={handleSubmit} />
          : <>
              {messages.map((msg, i) => (
                <MessageBubble key={msg.id || i} message={msg} onResearchUpdate={onResearchUpdate} />
              ))}
              {isLoading && phase === 'streaming' && streamingText && (
                <div className="message-row message-row--assistant animate-fadeIn">
                  <div className="avatar avatar--ai"><span>✛</span></div>
                  <div className="message-bubble message-bubble--assistant">
                    <div className="message-content markdown-body">
                      <ReactMarkdown>{streamingText}</ReactMarkdown>
                    </div>
                    <span className="cursor-blink">▋</span>
                  </div>
                </div>
              )}
              {isLoading && phase !== 'streaming' && <ThinkingIndicator />}
            </>
        }
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            placeholder="Ask about treatments, clinical trials, research findings…"
            rows={1}
            disabled={isLoading}
          />
          <button
            className={`send-btn ${input.trim() && !isLoading ? 'send-btn--active' : ''}`}
            onClick={() => handleSubmit()}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? <span className="spinner" /> : <span className="send-icon">↑</span>}
          </button>
        </div>
        <div className="chat-hint"><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> new line</div>
      </div>
    </div>
  );
}

function phaseLabel(phase) {
  if (phase === 'researching') return '◈ Retrieving research…';
  if (phase === 'streaming') return '✛ Synthesizing…';
  return '…';
}

function WelcomeScreen({ onSuggest }) {
  return (
    <div className="welcome">
      <div className="welcome__icon"><span>✛</span></div>
      <h1 className="welcome__title">Curalink Research AI</h1>
      <p className="welcome__subtitle">Evidence-based medical research at your fingertips.<br />Powered by PubMed · OpenAlex · ClinicalTrials.gov</p>
      <div className="welcome__sources">
        {['PubMed', 'OpenAlex', 'ClinicalTrials.gov'].map(src => (
          <div key={src} className="source-badge"><span className="source-dot">◆</span><span>{src}</span></div>
        ))}
      </div>
      <div className="welcome__suggestions">
        <div className="suggestions-label">Try asking…</div>
        <div className="suggestions-grid">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="suggestion-pill" onClick={() => onSuggest(s)}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onResearchUpdate }) {
  const isUser = message.role === 'user';
  const hasResearch = message.publications?.length > 0 || message.clinicalTrials?.length > 0;
  return (
    <div className={`message-row ${isUser ? 'message-row--user' : 'message-row--assistant'} animate-fadeInUp`}>
      {!isUser && <div className="avatar avatar--ai"><span>✛</span></div>}
      <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'} ${message.isError ? 'message-bubble--error' : ''}`}>
        {!isUser && message.expandedQuery && (
          <div className="expanded-query-badge">
            <span className="eq-icon">◈</span>
            <span className="eq-label">Query expanded to:</span>
            <span className="eq-value">{message.expandedQuery}</span>
          </div>
        )}
        <div className="message-content markdown-body">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {hasResearch && (
          <div className="research-summary-tags">
            {message.publications?.length > 0 && (
              <button className="research-tag research-tag--pub"
                onClick={() => onResearchUpdate?.({ publications: message.publications, clinicalTrials: message.clinicalTrials || [], expandedQuery: message.expandedQuery })}>
                <span>◈</span> {message.publications.length} Publications
              </button>
            )}
            {message.clinicalTrials?.length > 0 && (
              <button className="research-tag research-tag--trial"
                onClick={() => onResearchUpdate?.({ publications: message.publications || [], clinicalTrials: message.clinicalTrials, expandedQuery: message.expandedQuery })}>
                <span>⬡</span> {message.clinicalTrials.length} Clinical Trials
              </button>
            )}
          </div>
        )}
        <div className="message-time">
          {message.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUser && <div className="avatar avatar--user"><span>◉</span></div>}
    </div>
  );
}

const THINK_STEPS = [
  { delay: 0,   text: 'Expanding query with AI…' },
  { delay: 0.5, text: 'Fetching PubMed publications…' },
  { delay: 1.0, text: 'Searching OpenAlex database…' },
  { delay: 1.5, text: 'Retrieving ClinicalTrials.gov…' },
  { delay: 2.0, text: 'Ranking & merging 150+ results…' },
];

function ThinkingIndicator() {
  return (
    <div className="message-row message-row--assistant animate-fadeIn">
      <div className="avatar avatar--ai"><span>✛</span></div>
      <div className="message-bubble message-bubble--assistant thinking-bubble">
        <div className="thinking-steps">
          {THINK_STEPS.map((step, i) => (
            <div key={i} className="think-step" style={{ animationDelay: `${step.delay}s` }}>
              <span className="think-dot" style={{ animationDelay: `${step.delay}s` }}>◆</span>
              <span className="think-text">{step.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
