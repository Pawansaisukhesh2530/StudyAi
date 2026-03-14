import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Loader2, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { generateQuiz, type QuizQuestion } from '../services/geminiService';
import {
  getTopics,
  getActiveTopicId,
  setActiveTopic,
  updateTopic,
  createQuiz,
  completeQuiz,
  incrementAiInteraction,
  type Topic,
} from '../services/storage';
import { clearPendingAction, getPendingAction } from '../services/intentSystem';

export default function QuizzesPage() {
  const [topics, setTopics] = useState<Topic[]>(() => getTopics());
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(() => {
    const active = getActiveTopicId();
    return active ?? (getTopics()[0]?.id ?? null);
  });
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const commandRanRef = useRef(false);

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? null,
    [topics, selectedTopicId]
  );

  const activeQuestions = selectedTopic?.quizzes ?? [];

  useEffect(() => {
    if (commandRanRef.current) return;
    const pending = getPendingAction();
    if (!pending || pending.intent !== 'generate_quiz') return;

    commandRanRef.current = true;

    if (pending.topic) {
      const byName = topics.find((t) => t.name.toLowerCase().trim() === pending.topic?.toLowerCase().trim());
      if (byName) {
        setSelectedTopicId(byName.id);
        setActiveTopic(byName.id);
      }
    }

    clearPendingAction();
    setTimeout(() => {
      void handleGenerateFromTopic();
    }, 0);
  }, [topics]);

  async function handleGenerateFromTopic() {
    if (!selectedTopic) return;
    setLoading(true);
    setError(null);
    try {
      const questions: QuizQuestion[] = await generateQuiz(selectedTopic.name, questionCount);
      incrementAiInteraction();
      updateTopic(selectedTopic.id, { quizzes: questions });
      setTopics(getTopics());
      setAnswers({});
      setSubmitted(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz.');
    } finally {
      setLoading(false);
    }
  }

  function handleAnswer(qIdx: number, optIdx: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  }

  function handleSubmit() {
    if (!selectedTopic || activeQuestions.length === 0) return;
    const correct = activeQuestions.reduce((acc, q, i) => {
      return acc + (answers[i] === q.correctIndex ? 1 : 0);
    }, 0);
    const score = Math.round((correct / activeQuestions.length) * 100);
    const record = createQuiz(selectedTopic.name, activeQuestions);
    completeQuiz(record.id, score);
    setSubmitted(true);
  }

  const currentScore = (() => {
    if (!submitted || activeQuestions.length === 0) return null;
    const correct = activeQuestions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
      0
    );
    return { correct, total: activeQuestions.length, percent: Math.round((correct / activeQuestions.length) * 100) };
  })();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Quiz Generator</h1>
        <p className="page-subtitle">Generate quizzes from your selected topic without re-entering it.</p>
      </div>

      <div className="card">
        <div className="input-row">
          <select
            className="select-input"
            value={selectedTopicId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedTopicId(id);
              setActiveTopic(id);
              setAnswers({});
              setSubmitted(false);
            }}
          >
            {topics.length === 0 && <option value="">No topics available</option>}
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </select>
          <select
            className="select-input"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          >
            {[3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>{n} questions</option>
            ))}
          </select>
          <button
            className="btn btn--primary"
            onClick={handleGenerateFromTopic}
            disabled={loading || !selectedTopic}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <HelpCircle size={16} />}
            <span>{loading ? 'Generating...' : 'Generate Quiz'}</span>
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {selectedTopic && activeQuestions.length > 0 && (
        <div className="card quiz-view">
            <div className="card__header">
              <h2 className="card__title">Quiz: {selectedTopic.name}</h2>
              {submitted && currentScore && (
                <div className={`score-display ${currentScore.correct / currentScore.total >= 0.7 ? 'score-display--good' : 'score-display--bad'}`}>
                  <Trophy size={18} />
                  <span>{currentScore.correct}/{currentScore.total} ({currentScore.percent}%)</span>
                </div>
              )}
            </div>

            <div className="quiz-questions">
              {activeQuestions.map((q, qi) => (
                <QuizQuestionCard
                  key={qi}
                  question={q}
                  index={qi}
                  selectedOption={answers[qi] ?? null}
                  submitted={submitted}
                  onAnswer={(optIdx) => handleAnswer(qi, optIdx)}
                />
              ))}
            </div>

            {!submitted && (
              <button
                className="btn btn--primary"
                onClick={handleSubmit}
                disabled={Object.keys(answers).length < activeQuestions.length}
              >
                Submit Quiz
              </button>
            )}

            {submitted && (
              <button
                className="btn btn--secondary"
                onClick={() => {
                  setAnswers({});
                  setSubmitted(false);
                }}
              >
                Retake Quiz
              </button>
            )}
        </div>
      )}

      {selectedTopic && activeQuestions.length === 0 && (
        <div className="card empty-state-card">
          <div className="empty-state">
            <HelpCircle size={40} className="empty-state__icon" />
            <h3>No quiz generated for this topic yet</h3>
            <p>Use Generate Quiz to create practice questions from this selected topic.</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface QuizQuestionCardProps {
  question: QuizQuestion;
  index: number;
  selectedOption: number | null;
  submitted: boolean;
  onAnswer: (optIdx: number) => void;
}

function QuizQuestionCard({
  question,
  index,
  selectedOption,
  submitted,
  onAnswer,
}: QuizQuestionCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="quiz-question">
      <p className="quiz-question__text">
        <span className="quiz-question__num">{index + 1}.</span> {question.question}
      </p>
      <div className="quiz-question__options">
        {question.options.map((opt, oi) => {
          let cls = 'quiz-option';
          if (submitted) {
            if (oi === question.correctIndex) cls += ' quiz-option--correct';
            else if (oi === selectedOption) cls += ' quiz-option--wrong';
          } else if (oi === selectedOption) {
            cls += ' quiz-option--selected';
          }
          return (
            <button key={oi} className={cls} onClick={() => onAnswer(oi)}>
              <span className="quiz-option__letter">{String.fromCharCode(65 + oi)}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {submitted && (
        <button
          className="quiz-explanation-toggle"
          onClick={() => setShowExplanation((v) => !v)}
        >
          {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showExplanation ? 'Hide explanation' : 'Show explanation'}
        </button>
      )}
      {submitted && showExplanation && (
        <div className="quiz-explanation">{question.explanation}</div>
      )}
    </div>
  );
}
