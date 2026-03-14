import { useState } from 'react';
import { Settings, Key, Trash2, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('studyai_api_key') ?? '');
  const [saved, setSaved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  function handleSaveApiKey() {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem('studyai_api_key', trimmed);
    } else {
      localStorage.removeItem('studyai_api_key');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClearData() {
    const keys = [
      'studyai_conversations',
      'studyai_topics',
      'studyai_quizzes',
      'studyai_notes',
      'studyai_stats',
    ];
    keys.forEach((k) => localStorage.removeItem(k));
    setShowClearConfirm(false);
    window.location.reload();
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your StudyAI experience.</p>
      </div>

      {/* API Key section */}
      <div className="card settings-section">
        <div className="settings-section__header">
          <Key size={20} />
          <h2 className="settings-section__title">Gemini API Key</h2>
        </div>
        <p className="settings-section__description">
          Enter your Google Gemini API key to power the AI features. You can get a free key from{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
            Google AI Studio
          </a>
          .
        </p>
        <p className="settings-section__note">
          <strong>Note:</strong> The key is also read from the <code>VITE_GEMINI_API_KEY</code> environment variable in your <code>.env</code> file. The key saved here takes precedence at runtime.
        </p>
        <div className="input-row">
          <input
            className="text-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            autoComplete="off"
          />
          <button className="btn btn--primary" onClick={handleSaveApiKey}>
            {saved ? '✓ Saved' : 'Save Key'}
          </button>
        </div>
      </div>

      {/* About section */}
      <div className="card settings-section">
        <div className="settings-section__header">
          <Settings size={20} />
          <h2 className="settings-section__title">About StudyAI</h2>
        </div>
        <p className="settings-section__description">
          StudyAI is an AI-powered learning assistant built with React and Google Gemini API.
          All your data (conversations, notes, quizzes, topics) is stored locally in your browser.
        </p>
        <ul className="settings-list">
          <li><strong>Version:</strong> 1.0.0</li>
          <li><strong>AI Model:</strong> Google Gemini 1.5 Flash</li>
          <li><strong>Storage:</strong> Browser localStorage</li>
        </ul>
      </div>

      {/* Danger zone */}
      <div className="card settings-section settings-section--danger">
        <div className="settings-section__header">
          <AlertTriangle size={20} color="#ef4444" />
          <h2 className="settings-section__title" style={{ color: '#ef4444' }}>Danger Zone</h2>
        </div>
        <p className="settings-section__description">
          Permanently delete all your study data including conversations, notes, quizzes, and topics. This cannot be undone.
        </p>
        {!showClearConfirm ? (
          <button className="btn btn--danger" onClick={() => setShowClearConfirm(true)}>
            <Trash2 size={16} /> Clear All Data
          </button>
        ) : (
          <div className="confirm-row">
            <span>Are you sure? This will permanently delete all your data.</span>
            <button className="btn btn--danger" onClick={handleClearData}>Yes, Delete Everything</button>
            <button className="btn btn--ghost" onClick={() => setShowClearConfirm(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
