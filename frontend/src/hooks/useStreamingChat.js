import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * useStreamingChat
 * Connects to /api/chat/stream via SSE for real-time token streaming.
 * Falls back to /api/chat (non-streaming) if SSE fails.
 */
export function useStreamingChat({ sessionId, patientContext, addMessage, onResearchUpdate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | researching | streaming | done
  const abortRef = useRef(null);

  const send = useCallback(async (message) => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    setStreamingText('');
    setPhase('researching');

    // Add user message immediately
    addMessage({ role: 'user', content: message });

    const tempId = uuidv4();
    let researchData = null;
    let fullText = '';

    try {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message,
          patientName: patientContext.patientName,
          disease: patientContext.disease,
          location: patientContext.location,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      abortRef.current = reader;

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith('event: ')) continue; // event name line
          if (!line.startsWith('data: ')) continue;

          const raw = line.slice(6).trim();
          if (!raw) continue;

          let parsed;
          try { parsed = JSON.parse(raw); } catch { continue; }

          // Parse event type from prior line — use a simpler approach: embed event in data
          // Since we can't easily pair event+data lines here, check for known keys
          if (parsed.publications !== undefined) {
            // research_done event
            researchData = parsed;
            setPhase('streaming');
            if (onResearchUpdate) {
              onResearchUpdate({
                publications: parsed.publications,
                clinicalTrials: parsed.clinicalTrials,
                expandedQuery: parsed.expandedQuery,
                query: message,
              });
            }
          } else if (parsed.token !== undefined) {
            // stream_token event
            fullText += parsed.token;
            setStreamingText(fullText);
          } else if (parsed.fullResponse !== undefined) {
            // stream_done event
            fullText = parsed.fullResponse;
            setPhase('done');
          } else if (parsed.message && !parsed.token) {
            // research_start or stream_start — status messages, ignore
          }
        }
      }

      // Commit final assistant message
      addMessage({
        role: 'assistant',
        content: fullText || streamingText,
        publications: researchData?.publications || [],
        clinicalTrials: researchData?.clinicalTrials || [],
        expandedQuery: researchData?.expandedQuery,
      });

    } catch (err) {
      console.warn('[Stream] SSE failed, falling back to REST:', err.message);

      // Fallback to standard REST API
      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message,
            patientName: patientContext.patientName,
            disease: patientContext.disease,
            location: patientContext.location,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        addMessage({
          role: 'assistant',
          content: data.message,
          publications: data.publications || [],
          clinicalTrials: data.clinicalTrials || [],
          expandedQuery: data.expandedQuery,
        });

        if (onResearchUpdate && (data.publications?.length || data.clinicalTrials?.length)) {
          onResearchUpdate({
            publications: data.publications || [],
            clinicalTrials: data.clinicalTrials || [],
            expandedQuery: data.expandedQuery,
            query: message,
          });
        }
      } catch (fallbackErr) {
        addMessage({
          role: 'assistant',
          content: `⚠️ Error: ${fallbackErr.message}`,
          isError: true,
        });
      }
    } finally {
      setIsLoading(false);
      setStreamingText('');
      setPhase('idle');
      abortRef.current = null;
    }
  }, [isLoading, sessionId, patientContext, addMessage, onResearchUpdate]);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.cancel();
      setIsLoading(false);
      setPhase('idle');
    }
  }, []);

  return { send, isLoading, streamingText, phase, abort };
}
