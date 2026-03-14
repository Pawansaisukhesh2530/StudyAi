import { useState } from 'react';
import { ChevronRight, ChevronLeft, Loader2, Play, CheckCircle2, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  generateExplanation,
  generateFlashcards,
  generateQuiz,
  type Flashcard,
  type QuizQuestion,
} from '../services/geminiService';
import {
  upsertTopicFromExplanation,
  updateTopic,
  createQuiz,
  incrementAiInteraction,
  setActiveTopic,
  completeTopicStep,
  incrementConceptsLearned,
  getActiveTopic,
} from '../services/storage';
import StructuredExplanation from '../components/StructuredExplanation';
import FlashCard from '../components/FlashCard';
import { SkeletonExplanation, SkeletonCard } from '../components/SkeletonLoader';
import MarkdownRenderer from '../components/MarkdownRenderer';

const STEPS = [
  { key: 'topic', label: 'Choose Topic', emoji: '🎯', description: 'Enter a topic to start learning' },
  { key: 'explanation', label: 'Explanation', emoji: '📘', description: 'AI generates a structured overview' },
  { key: 'concepts', label: 'Key Concepts', emoji: '🧠', description: 'Review the core ideas' },
  { key: 'flashcards', label: 'Flashcards', emoji: '🎴', description: 'Memorize key terms' },
  { key: 'quiz', label: 'Quiz', emoji: '🎯', description: 'Test your knowledge' },
  { key: 'summary', label: 'Summary', emoji: '🏆', description: 'Review and celebrate' },
];

export default function LearningModePage() {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [topicInput, setTopicInput] = useState(() => getActiveTopic()?.name ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [currentTopicName, setCurrentTopicName] = useState('');

  async function handleStart() {
    const trimmed = topicInput.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setCurrentTopicName(trimmed);
    try {
      const text = await generateExplanation(trimmed);
      incrementAiInteraction();
      const topic = upsertTopicFromExplanation(trimmed, text);
      setActiveTopic(topic.id);
      completeTopicStep(topic.id, 'explanation');
      incrementConceptsLearned(4);
      setExplanation(text);
      setStepIdx(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start learning.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvanceToFlashcards() {
    setLoading(true);
    setError(null);
    try {
      const cards = await generateFlashcards(currentTopicName, 6);
      incrementAiInteraction();
      const topic = upsertTopicFromExplanation(currentTopicName, explanation);
      updateTopic(topic.id, { flashcards: cards });
      completeTopicStep(topic.id, 'flashcards');
      setFlashcards(cards);
      setCardIndex(0);
      setStepIdx(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flashcards.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvanceToQuiz() {
    setLoading(true);
    setError(null);
    try {
      const qs = await generateQuiz(currentTopicName, 5);
      incrementAiInteraction();
      const topic = upsertTopicFromExplanation(currentTopicName, explanation);
      updateTopic(topic.id, { quizzes: qs });
      createQuiz(currentTopicName, qs);
      completeTopicStep(topic.id, 'quiz');
      setQuestions(qs);
      setAnswers({});
      setQuizSubmitted(false);
      setStepIdx(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuizAnswer(qi: number, opt: number) {
    if (!quizSubmitted) setAnswers((prev) => ({ ...prev, [qi]: opt }));
  }

  function handleQuizSubmit() {
    setQuizSubmitted(true);
    setStepIdx(5);
  }

  const quizScore = quizSubmitted && questions.length > 0
    ? Math.round((questions.filter((q, i) => answers[i] === q.correctIndex).length / questions.length) * 100)
    : null;

  const progressPct = (stepIdx / (STEPS.length - 1)) * 100;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🚀 Learning Mode</h1>
        <p className="page-subtitle">A guided AI-powered learning experience, step by step.</p>
      </div>

      {/* Step progress bar */}
      <div className="learn-progress card">
        <div className="learn-progress__steps">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`learn-step ${i < stepIdx ? 'learn-step--done' : ''} ${i === stepIdx ? 'learn-step--active' : ''}`}
            >
              <div className="learn-step__circle">
                {i < stepIdx ? <CheckCircle2 size={16} /> : <span>{i + 1}</span>}
              </div>
              <span className="learn-step__label">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="learn-progress__track">
          <div className="learn-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Step 0: Topic selection */}
      {stepIdx === 0 && (
        <div className="card learn-panel">
          <div className="learn-panel__header">
            <span className="learn-panel__emoji">🎯</span>
            <div>
              <h2 className="learn-panel__title">Choose Your Topic</h2>
              <p className="learn-panel__subtitle">What do you want to learn today?</p>
            </div>
          </div>
          <div className="input-row" style={{ marginTop: '1rem' }}>
            <input
              className="text-input"
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleStart()}
              placeholder="e.g. Internet of Things, Machine Learning, Photosynthesis..."
            />
            <button className="btn btn--primary" onClick={handleStart} disabled={loading || !topicInput.trim()}>
              {loading ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
              <span>{loading ? 'Starting...' : 'Start Learning'}</span>
            </button>
          </div>
          <div className="workspace-suggestions" style={{ marginTop: '0.75rem' }}>
            {['Internet of Things', 'Quantum Computing', 'Machine Learning', 'Black Holes', 'DNA and Genetics'].map((s) => (
              <button key={s} className="chip" onClick={() => setTopicInput(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Explanation */}
      {stepIdx === 1 && (
        <div className="learn-panel-content">
          {loading ? <SkeletonExplanation /> : (
            <>
              <div className="learn-panel__step-header">
                <span>📘</span>
                <h2>Explanation: {currentTopicName}</h2>
              </div>
              <StructuredExplanation content={explanation} />
              <div className="learn-nav">
                <button className="btn btn--primary" onClick={() => setStepIdx(2)}>
                  Next: Key Concepts <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: Concepts (re-render explanation, focusing on key concepts section) */}
      {stepIdx === 2 && (
        <div className="learn-panel-content">
          <div className="learn-panel__step-header">
            <span>🧠</span>
            <h2>Key Concepts: {currentTopicName}</h2>
          </div>
          <div className="card">
            <MarkdownRenderer content={explanation} />
          </div>
          <div className="learn-nav">
            <button className="btn btn--ghost" onClick={() => setStepIdx(1)}>
              <ChevronLeft size={16} /> Back
            </button>
            <button className="btn btn--primary" onClick={handleAdvanceToFlashcards} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              Next: Flashcards <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Flashcards */}
      {stepIdx === 3 && (
        <div className="learn-panel-content">
          <div className="learn-panel__step-header">
            <span>🎴</span>
            <h2>Flashcards: {currentTopicName}</h2>
          </div>
          {loading ? <SkeletonCard /> : (
            <>
              {flashcards.length > 0 && (
                <>
                  <div className="flashcards-progress">
                    <div className="flashcards-progress__bar">
                      <div className="flashcards-progress__fill" style={{ width: `${((cardIndex + 1) / flashcards.length) * 100}%` }} />
                    </div>
                    <span className="flashcards-progress__label">{cardIndex + 1} / {flashcards.length}</span>
                  </div>
                  <FlashCard card={flashcards[cardIndex]} index={cardIndex} total={flashcards.length} />
                  <div className="flashcards-nav">
                    <button className="btn btn--ghost" onClick={() => setCardIndex((i) => Math.max(0, i - 1))} disabled={cardIndex === 0}>
                      <ChevronLeft size={18} /> Previous
                    </button>
                    <button className="btn btn--primary" onClick={() => setCardIndex((i) => Math.min(flashcards.length - 1, i + 1))} disabled={cardIndex === flashcards.length - 1}>
                      Next <ChevronRight size={18} />
                    </button>
                  </div>
                </>
              )}
              <div className="learn-nav">
                <button className="btn btn--ghost" onClick={() => setStepIdx(2)}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button className="btn btn--primary" onClick={handleAdvanceToQuiz} disabled={loading}>
                  {loading ? <Loader2 size={16} className="spin" /> : null}
                  Next: Quiz <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Quiz */}
      {stepIdx === 4 && (
        <div className="learn-panel-content">
          <div className="learn-panel__step-header">
            <span>🎯</span>
            <h2>Quiz: {currentTopicName}</h2>
          </div>
          {loading ? <SkeletonCard /> : (
            <div className="quiz-questions">
              {questions.map((q, qi) => (
                <div key={qi} className="quiz-question card">
                  <p className="quiz-question__text">
                    <span className="quiz-question__num">{qi + 1}.</span> {q.question}
                  </p>
                  <div className="quiz-question__options">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        className={`quiz-option ${answers[qi] === oi && !quizSubmitted ? 'quiz-option--selected' : ''}`}
                        onClick={() => handleQuizAnswer(qi, oi)}
                        disabled={quizSubmitted}
                      >
                        <span className="quiz-option__letter">{String.fromCharCode(65 + oi)}</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!quizSubmitted && (
                <button className="btn btn--primary" onClick={handleQuizSubmit} disabled={Object.keys(answers).length < questions.length}>
                  Submit Quiz
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Summary */}
      {stepIdx === 5 && (
        <div className="learn-panel-content">
          <div className="card learn-summary">
            <div className="learn-summary__header">
              <span style={{ fontSize: '3rem' }}>
                {(quizScore ?? 0) >= 70 ? '🏆' : '📚'}
              </span>
              <h2 className="learn-summary__title">
                {(quizScore ?? 0) >= 70 ? 'Great work!' : 'Keep practicing!'}
              </h2>
              <p className="learn-summary__subtitle">You completed the learning flow for <strong>{currentTopicName}</strong></p>
            </div>
            {quizScore !== null && (
              <div className={`score-display ${quizScore >= 70 ? 'score-display--good' : 'score-display--bad'}`} style={{ alignSelf: 'center', marginBottom: '1rem' }}>
                Quiz Score: {quizScore}%
              </div>
            )}
            <div className="learn-summary__steps">
              {[
                { emoji: '📘', label: 'Explanation', done: true },
                { emoji: '🧠', label: 'Key Concepts', done: true },
                { emoji: '🎴', label: 'Flashcards', done: flashcards.length > 0 },
                { emoji: '🎯', label: 'Quiz', done: quizSubmitted },
              ].map(({ emoji, label, done }) => (
                <div key={label} className={`learn-summary__item ${done ? 'learn-summary__item--done' : ''}`}>
                  <span>{emoji}</span>
                  <span>{label}</span>
                  {done && <CheckCircle2 size={14} className="learn-summary__check" />}
                </div>
              ))}
            </div>
            <div className="learn-nav" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn--secondary" onClick={() => { setStepIdx(0); setTopicInput(''); setExplanation(''); setFlashcards([]); setQuestions([]); }}>
                Start New Topic
              </button>
              <button className="btn btn--primary" onClick={() => navigate('/workspace')}>
                <BookOpen size={16} /> Back to Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
