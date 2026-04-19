import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import './PatientContextModal.css';

export default function PatientContextModal({ onClose }) {
  const { patientContext, updateContext } = useSession();
  const [form, setForm] = useState({ ...patientContext });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = () => {
    updateContext(form);
    onClose();
  };

  const DISEASE_SUGGESTIONS = [
    'Parkinson\'s Disease', 'Lung Cancer', 'Type 2 Diabetes',
    'Alzheimer\'s Disease', 'Heart Disease', 'Breast Cancer',
    'Multiple Sclerosis', 'Rheumatoid Arthritis', 'Crohn\'s Disease',
  ];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card animate-fadeInUp">
        <div className="modal-header">
          <div className="modal-icon">◉</div>
          <div>
            <h2 className="modal-title">Patient Context</h2>
            <p className="modal-subtitle">Set context for personalized research</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Patient Name <span className="field-optional">(optional)</span></label>
            <input
              className="field-input"
              name="patientName"
              value={form.patientName}
              onChange={handleChange}
              placeholder="e.g. John Smith"
              autoComplete="off"
            />
          </div>

          <div className="field-group">
            <label className="field-label">Disease / Condition</label>
            <input
              className="field-input"
              name="disease"
              value={form.disease}
              onChange={handleChange}
              placeholder="e.g. Parkinson's Disease"
              autoComplete="off"
            />
            <div className="disease-suggestions">
              {DISEASE_SUGGESTIONS.map(d => (
                <button
                  key={d}
                  className={`disease-chip ${form.disease === d ? 'disease-chip--active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, disease: d }))}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Location <span className="field-optional">(for nearby trials)</span></label>
            <input
              className="field-input"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="e.g. Toronto, Canada"
              autoComplete="off"
            />
          </div>

          <div className="modal-info">
            <span className="info-icon">◆</span>
            <span>This context personalizes responses and filters clinical trials by location. Your data is stored locally.</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Context</button>
        </div>
      </div>
    </div>
  );
}
