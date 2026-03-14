import { useState } from 'react';
import { Search, Lightbulb, Loader2, HelpCircle, FileText, Save } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { generateExplanation, generateNotes, generateQuiz } from '../services/geminiService';
import {
  upsertTopicFromExplanation,
  getActiveTopic,
  setActiveTopic,
  updateTopic,
  createQuiz,
  saveNote,
  incrementAiInteraction,
  type Topic,
} from '../services/storage';

export default function WorkspacePage() {
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(() => getActiveTopic());
  const [topic, setTopic] = useState(() => getActiveTopic()?.name ?? '');
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleGenerateExplanation() {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setLoadingExplanation(true);
    setError(null);
    setSaved(false);
    try {
      const text = await generateExplanation(trimmed);
      incrementAiInteraction();
      const nextTopic = upsertTopicFromExplanation(trimmed, text);
      setCurrentTopic(nextTopic);
      setActiveTopic(nextTopic.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate explanation.');
    } finally {
      setLoadingExplanation(false);
    }
  }

  function handleSaveTopic() {
    if (!currentTopic) return;
    setActiveTopic(currentTopic.id);
    setSaved(true);
  }

  async function handleGenerateQuiz() {
    if (!currentTopic || loadingQuiz) return;
    setLoadingQuiz(true);
    setError(null);
    try {
      const questions = await generateQuiz(currentTopic.name, 5);
      incrementAiInteraction();
      updateTopic(currentTopic.id, { quizzes: questions });
      createQuiz(currentTopic.name, questions);
      setCurrentTopic((prev) => (prev ? { ...prev, quizzes: questions } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz.');
    } finally {
      setLoadingQuiz(false);
    }
  }

  async function handleGenerateNotes() {
    if (!currentTopic || loadingNotes) return;
    setLoadingNotes(true);
    setError(null);
    try {
      const notes = await generateNotes(currentTopic.name);
      incrementAiInteraction();
      updateTopic(currentTopic.id, { notes });
      saveNote({ topic: currentTopic.name, content: notes });
      setCurrentTopic((prev) => (prev ? { ...prev, notes } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notes.');
    } finally {
      setLoadingNotes(false);
    }
  }

  const isAnyLoading = loadingExplanation || loadingQuiz || loadingNotes;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Learning Workspace</h1>
        <p className="page-subtitle">Enter one topic, then generate all learning resources from it.</p>
      </div>

      <div className="workspace-input-card card">
        <div className="input-row">
          <div className="input-wrapper">
            <Search size={18} className="input-icon" />
            <input
              className="text-input text-input--with-icon"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateExplanation()}
              placeholder="Enter a topic to learn about..."
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={handleGenerateExplanation}
            disabled={isAnyLoading || !topic.trim()}
          >
            {loadingExplanation ? <Loader2 size={16} className="spin" /> : <Lightbulb size={16} />}
            <span>{loadingExplanation ? 'Generating...' : 'Generate Explanation'}</span>
          </button>
        </div>

        <div className="workspace-suggestions">
          {['Photosynthesis', 'Quantum Physics', 'World War II', 'Machine Learning', 'Calculus'].map((s) => (
            <button key={s} className="chip" onClick={() => setTopic(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {currentTopic?.explanation && (
        <div className="card workspace-result">
          <div className="card__header">
            <h2 className="card__title">
              <Lightbulb size={18} /> Explanation: {currentTopic.name}
            </h2>
            <div className="card__actions">
              <button
                className="btn btn--secondary"
                onClick={handleGenerateQuiz}
                disabled={isAnyLoading}
              >
                {loadingQuiz ? <Loader2 size={14} className="spin" /> : <HelpCircle size={14} />}
                <span>{loadingQuiz ? 'Generating Quiz...' : 'Generate Quiz'}</span>
              </button>
              <button
                className="btn btn--secondary"
                onClick={handleGenerateNotes}
                disabled={isAnyLoading}
              >
                {loadingNotes ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
                <span>{loadingNotes ? 'Generating Notes...' : 'Generate Notes'}</span>
              </button>
              <button
                className={`btn ${saved ? 'btn--success' : 'btn--primary'}`}
                onClick={handleSaveTopic}
                disabled={isAnyLoading || saved}
              >
                <Save size={14} />
                <span>{saved ? 'Saved Topic' : 'Save Topic'}</span>
              </button>
            </div>
          </div>
          <div className="card__body">
            <MarkdownRenderer content={currentTopic.explanation} />
            {currentTopic.notes && (
              <div style={{ marginTop: '1rem' }}>
                <h3>Generated Notes</h3>
                <MarkdownRenderer content={currentTopic.notes} />
              </div>
            )}
            {currentTopic.quizzes.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h3>Generated Quiz ({currentTopic.quizzes.length} questions)</h3>
                <p className="page-subtitle">Open Quizzes page to practice this quiz.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
