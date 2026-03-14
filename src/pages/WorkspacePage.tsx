import { useState, useRef, useEffect } from 'react';
import {
  Search, Lightbulb, Loader2, HelpCircle, FileText, Save,
  Network, MessageCircle, Send, Zap, Baby, Globe, Shuffle,
  ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StructuredExplanation from '../components/StructuredExplanation';
import LearningPipeline from '../components/LearningPipeline';
import DiagramView from '../components/DiagramView';
import { SkeletonExplanation } from '../components/SkeletonLoader';
import MarkdownRenderer from '../components/MarkdownRenderer';
import {
  generateExplanation,
  generateQuiz,
  generateNotes,
  generateDiagram,
  reexplain,
  generateFollowUpAnswer,
  type ExplainMode,
  type DiagramData,
} from '../services/geminiService';
import {
  upsertTopicFromExplanation,
  getActiveTopic,
  setActiveTopic,
  updateTopic,
  createQuiz,
  saveNote,
  incrementAiInteraction,
  completeTopicStep,
  incrementConceptsLearned,
  type Topic,
} from '../services/storage';
import { clearPendingAction, getPendingAction } from '../services/intentSystem';

const SUGGESTIONS = ['Internet of Things', 'Quantum Computing', 'Machine Learning', 'Climate Change', 'Photosynthesis', 'World War II'];

const EXPLAIN_MODES: { mode: ExplainMode; icon: typeof Zap; label: string; color: string }[] = [
  { mode: 'simpler', icon: Zap, label: 'Explain Simpler', color: '#6366f1' },
  { mode: 'eli5', icon: Baby, label: "Explain Like I'm 5", color: '#a855f7' },
  { mode: 'examples', icon: Globe, label: 'Add Real Examples', color: '#10b981' },
  { mode: 'analogies', icon: Shuffle, label: 'Use Analogies', color: '#f59e0b' },
];

export default function WorkspacePage() {
  const navigate = useNavigate();
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(() => getActiveTopic());
  const [topic, setTopic] = useState(() => getActiveTopic()?.name ?? '');
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingDiagram, setLoadingDiagram] = useState(false);
  const [loadingReexplain, setLoadingReexplain] = useState<ExplainMode | null>(null);
  const [loadingFollowUp, setLoadingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [showDiagram, setShowDiagram] = useState(true);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const followUpRef = useRef<HTMLTextAreaElement>(null);

  const isAnyLoading = loadingExplanation || loadingQuiz || loadingNotes || loadingDiagram || !!loadingReexplain || loadingFollowUp;

  async function handleGenerateExplanation() {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setLoadingExplanation(true);
    setError(null);
    setSaved(false);
    setDiagramData(null);
    setFollowUpAnswer(null);
    try {
      const text = await generateExplanation(trimmed);
      incrementAiInteraction();
      const nextTopic = upsertTopicFromExplanation(trimmed, text);
      completeTopicStep(nextTopic.id, 'explanation');
      incrementConceptsLearned(4);
      setCurrentTopic({ ...nextTopic, completedSteps: [...(nextTopic.completedSteps ?? []), 'explanation'] });
      setActiveTopic(nextTopic.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate explanation.');
    } finally {
      setLoadingExplanation(false);
    }
  }

  async function handleReexplain(mode: ExplainMode) {
    if (!currentTopic?.explanation) return;
    setLoadingReexplain(mode);
    setError(null);
    try {
      const text = await reexplain(currentTopic.name, currentTopic.explanation, mode);
      incrementAiInteraction();
      const updated = updateTopic(currentTopic.id, { explanation: text });
      if (mode === 'examples') {
        completeTopicStep(currentTopic.id, 'examples');
      }
      if (updated) {
        const nextSteps = mode === 'examples'
          ? [...new Set([...(updated.completedSteps ?? []), 'examples'])]
          : updated.completedSteps;
        setCurrentTopic({ ...updated, completedSteps: nextSteps ?? [] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reexplain.');
    } finally {
      setLoadingReexplain(null);
    }
  }

  async function handleFollowUp() {
    const q = followUpInput.trim();
    if (!q || !currentTopic) return;
    setLoadingFollowUp(true);
    setError(null);
    try {
      const answer = await generateFollowUpAnswer(currentTopic.name, q);
      incrementAiInteraction();
      setFollowUpAnswer(answer);
      setFollowUpInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer.');
    } finally {
      setLoadingFollowUp(false);
    }
  }

  async function handleGenerateDiagram() {
    if (!currentTopic) return;
    setLoadingDiagram(true);
    setError(null);
    try {
      const data = await generateDiagram(currentTopic.name);
      incrementAiInteraction();
      const diagramStr = JSON.stringify(data);
      updateTopic(currentTopic.id, { diagram: diagramStr });
      setCurrentTopic((prev) => prev ? { ...prev, diagram: diagramStr } : prev);
      setDiagramData(data);
      setShowDiagram(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate diagram.');
    } finally {
      setLoadingDiagram(false);
    }
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
      completeTopicStep(currentTopic.id, 'quiz');
      completeTopicStep(currentTopic.id, 'summary');
      setCurrentTopic((prev) => prev ? {
        ...prev,
        quizzes: questions,
        completedSteps: [...new Set([...(prev.completedSteps ?? []), 'quiz', 'summary'])],
      } : prev);
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
      completeTopicStep(currentTopic.id, 'notes');
      setCurrentTopic((prev) => prev ? { ...prev, notes, completedSteps: [...(prev.completedSteps ?? []), 'notes'] } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notes.');
    } finally {
      setLoadingNotes(false);
    }
  }

  function handleSaveTopic() {
    if (!currentTopic) return;
    setActiveTopic(currentTopic.id);
    setSaved(true);
  }

  const activeDiagram: DiagramData | null = (() => {
    if (diagramData) return diagramData;
    if (currentTopic?.diagram) {
      try { return JSON.parse(currentTopic.diagram) as DiagramData; } catch { return null; }
    }
    return null;
  })();

  const completedSteps = currentTopic?.completedSteps ?? [];

  useEffect(() => {
    const pending = getPendingAction();
    if (!pending) return;

    if (pending.intent === 'explain_topic') {
      if (pending.topic) {
        setTopic(pending.topic);
      }
      clearPendingAction();
      const run = async () => {
        const nextTopic = pending.topic?.trim() || topic.trim();
        if (!nextTopic) return;
        setTopic(nextTopic);
        setLoadingExplanation(true);
        setError(null);
        try {
          const text = await generateExplanation(nextTopic);
          incrementAiInteraction();
          const savedTopic = upsertTopicFromExplanation(nextTopic, text);
          completeTopicStep(savedTopic.id, 'explanation');
          incrementConceptsLearned(4);
          setCurrentTopic({ ...savedTopic, completedSteps: [...(savedTopic.completedSteps ?? []), 'explanation'] });
          setActiveTopic(savedTopic.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to generate explanation.');
        } finally {
          setLoadingExplanation(false);
        }
      };
      void run();
      return;
    }

    if (pending.intent === 'save_topic') {
      clearPendingAction();
      if (currentTopic) handleSaveTopic();
    }
  }, [currentTopic]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Learning Workspace</h1>
        <p className="page-subtitle">Enter a topic once — then generate all learning resources from it.</p>
      </div>

      {/* Topic Input */}
      <div className="workspace-input-card card">
        <div className="input-row">
          <div className="input-wrapper">
            <Search size={18} className="input-icon" />
            <input
              className="text-input text-input--with-icon"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isAnyLoading && handleGenerateExplanation()}
              placeholder="Enter a topic to learn about..."
              disabled={loadingExplanation}
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={handleGenerateExplanation}
            disabled={isAnyLoading || !topic.trim()}
          >
            {loadingExplanation ? <Loader2 size={16} className="spin" /> : <Lightbulb size={16} />}
            <span>{loadingExplanation ? 'Generating...' : 'Start Learning'}</span>
          </button>
        </div>
        <div className="workspace-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => setTopic(s)} disabled={loadingExplanation}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Learning Pipeline */}
      {currentTopic && (
        <LearningPipeline
          completedSteps={completedSteps}
          hasExplanation={!!currentTopic.explanation}
          onStageClick={(stage) => {
            if (stage.key === 'explanation' || stage.key === 'concepts' || stage.key === 'examples') navigate('/workspace');
            if (stage.key === 'notes') navigate('/notes');
            else if (stage.key === 'flashcards') navigate('/flashcards');
            else if (stage.key === 'quiz') navigate('/quizzes');
            else if (stage.key === 'summary') navigate('/progress');
          }}
        />
      )}

      {/* Loading skeleton */}
      {loadingExplanation && <SkeletonExplanation />}

      {/* Explanation Content */}
      {!loadingExplanation && currentTopic?.explanation && (
        <>
          {/* Action bar */}
          <div className="workspace-action-bar card">
            <div className="workspace-action-bar__topic">
              <BookOpen size={16} className="workspace-action-bar__icon" />
              <span className="workspace-action-bar__name">{currentTopic.name}</span>
            </div>
            <div className="workspace-action-bar__actions">
              <button className="btn btn--secondary btn--sm" onClick={handleGenerateNotes} disabled={isAnyLoading}>
                {loadingNotes ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
                <span>{loadingNotes ? 'Generating...' : currentTopic.notes ? 'Notes ✓' : 'Generate Notes'}</span>
              </button>
              <button className="btn btn--secondary btn--sm" onClick={handleGenerateQuiz} disabled={isAnyLoading}>
                {loadingQuiz ? <Loader2 size={14} className="spin" /> : <HelpCircle size={14} />}
                <span>{loadingQuiz ? 'Generating...' : currentTopic.quizzes.length > 0 ? 'Quiz ✓' : 'Generate Quiz'}</span>
              </button>
              <button className="btn btn--secondary btn--sm" onClick={handleGenerateDiagram} disabled={isAnyLoading}>
                {loadingDiagram ? <Loader2 size={14} className="spin" /> : <Network size={14} />}
                <span>{loadingDiagram ? 'Generating...' : activeDiagram ? 'Diagram ✓' : 'Generate Diagram'}</span>
              </button>
              <button
                className={`btn btn--sm ${saved ? 'btn--success' : 'btn--primary'}`}
                onClick={handleSaveTopic}
                disabled={saved}
              >
                <Save size={14} />
                <span>{saved ? 'Saved ✓' : 'Save Topic'}</span>
              </button>
            </div>
          </div>

          {/* Structured Explanation */}
          <StructuredExplanation content={currentTopic.explanation} />

          {/* Explain Helper Buttons */}
          <div className="explain-helpers card">
            <div className="explain-helpers__header">
              <Zap size={16} />
              <span>Adjust Explanation Style</span>
            </div>
            <div className="explain-helpers__buttons">
              {EXPLAIN_MODES.map(({ mode, icon: Icon, label, color }) => (
                <button
                  key={mode}
                  className="explain-btn"
                  style={{ '--explain-color': color } as React.CSSProperties}
                  onClick={() => handleReexplain(mode)}
                  disabled={isAnyLoading}
                >
                  {loadingReexplain === mode ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Icon size={14} />
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Diagram */}
          {activeDiagram && (
            <div className="card">
              <div className="card__header">
                <h3 className="card__title">
                  <Network size={16} /> Concept Diagram
                </h3>
                <button className="icon-btn" onClick={() => setShowDiagram((s) => !s)}>
                  {showDiagram ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              {showDiagram && <DiagramView data={activeDiagram} />}
            </div>
          )}

          {/* Follow-up Q&A */}
          <div className="followup card">
            <div className="followup__toggle" onClick={() => setShowFollowUp((s) => !s)}>
              <MessageCircle size={16} />
              <span>Ask a follow-up question about {currentTopic.name}</span>
              {showFollowUp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>

            {showFollowUp && (
              <div className="followup__body">
                <div className="followup__input-row">
                  <textarea
                    ref={followUpRef}
                    className="followup__input"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    placeholder={`Ask anything about ${currentTopic.name}...`}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFollowUp(); }
                    }}
                  />
                  <button className="btn btn--primary" onClick={handleFollowUp} disabled={loadingFollowUp || !followUpInput.trim()}>
                    {loadingFollowUp ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                  </button>
                </div>
                {followUpAnswer && (
                  <div className="followup__answer">
                    <div className="followup__answer-label">Answer</div>
                    <MarkdownRenderer content={followUpAnswer} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation cards */}
          <div className="workspace-nav-cards">
            {[
              { emoji: '📝', title: 'Notes', desc: currentTopic.notes ? 'View generated notes' : 'Generate study notes', done: !!currentTopic.notes, to: '/notes' },
              { emoji: '🎴', title: 'Flashcards', desc: (currentTopic.flashcards?.length ?? 0) > 0 ? `${currentTopic.flashcards!.length} cards ready` : 'Generate flashcards', done: (currentTopic.flashcards?.length ?? 0) > 0, to: '/flashcards' },
              { emoji: '🎯', title: 'Quiz', desc: currentTopic.quizzes.length > 0 ? `${currentTopic.quizzes.length} questions ready` : 'Test your knowledge', done: currentTopic.quizzes.length > 0, to: '/quizzes' },
              { emoji: '🚀', title: 'Learning Mode', desc: 'Guided step-by-step experience', done: false, to: '/learn' },
            ].map(({ emoji, title, desc, done, to }) => (
              <div key={to} className="workspace-nav-card" onClick={() => navigate(to)}>
                <span className="workspace-nav-card__emoji">{emoji}</span>
                <div className="workspace-nav-card__info">
                  <div className="workspace-nav-card__title">{title}</div>
                  <div className="workspace-nav-card__desc">{desc}</div>
                </div>
                <div className={`workspace-nav-card__badge ${done ? 'workspace-nav-card__badge--done' : ''}`}>
                  {done ? '✓' : '→'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loadingExplanation && !currentTopic?.explanation && (
        <div className="card workspace-empty">
          <div className="empty-state">
            <span style={{ fontSize: '3rem' }}>🎓</span>
            <h3>Start Your Learning Journey</h3>
            <p>Enter any topic above and click <strong>Start Learning</strong> to generate a structured explanation, flashcards, notes, and a quiz.</p>
          </div>
        </div>
      )}
    </div>
  );
}
