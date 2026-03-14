import { useEffect, useRef, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, RotateCcw, Layers } from 'lucide-react';
import { generateFlashcards, type Flashcard } from '../services/geminiService';
import {
  getTopics,
  getActiveTopicId,
  setActiveTopic,
  updateTopic,
  incrementAiInteraction,
  completeTopicStep,
  type Topic,
} from '../services/storage';
import FlashCard from '../components/FlashCard';
import { SkeletonCard } from '../components/SkeletonLoader';
import { clearPendingAction, getPendingAction } from '../services/intentSystem';

export default function FlashcardsPage() {
  const [topics, setTopics] = useState<Topic[]>(() => getTopics());
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(() => {
    const active = getActiveTopicId();
    return active ?? (getTopics()[0]?.id ?? null);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const commandRanRef = useRef(false);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;
  const cards: Flashcard[] = selectedTopic?.flashcards ?? [];

  useEffect(() => {
    if (commandRanRef.current) return;
    const pending = getPendingAction();
    if (!pending || pending.intent !== 'generate_flashcards') return;

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
      void handleGenerate();
    }, 0);
  }, [topics]);

  async function handleGenerate() {
    if (!selectedTopic) return;
    setLoading(true);
    setError(null);
    setCardIndex(0);
    try {
      const generated = await generateFlashcards(selectedTopic.name, 8);
      incrementAiInteraction();
      updateTopic(selectedTopic.id, { flashcards: generated });
      completeTopicStep(selectedTopic.id, 'flashcards');
      setTopics(getTopics());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards.');
    } finally {
      setLoading(false);
    }
  }

  function handlePrev() {
    setCardIndex((i) => Math.max(0, i - 1));
  }

  function handleNext() {
    setCardIndex((i) => Math.min(cards.length - 1, i + 1));
  }

  function handleReset() {
    setCardIndex(0);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🎴 Flashcards</h1>
        <p className="page-subtitle">Click a card to flip it and reveal the answer.</p>
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
              setCardIndex(0);
            }}
          >
            {topics.length === 0 && <option value="">No topics available – create one in Workspace</option>}
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={loading || !selectedTopic}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Layers size={16} />}
            <span>{loading ? 'Generating...' : cards.length > 0 ? 'Regenerate' : 'Generate Flashcards'}</span>
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="flashcards-skeleton">
          <SkeletonCard />
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div className="flashcards-viewer">
          {/* Progress bar */}
          <div className="flashcards-progress">
            <div className="flashcards-progress__bar">
              <div
                className="flashcards-progress__fill"
                style={{ width: `${((cardIndex + 1) / cards.length) * 100}%` }}
              />
            </div>
            <span className="flashcards-progress__label">{cardIndex + 1} / {cards.length}</span>
          </div>

          {/* Card */}
          <FlashCard card={cards[cardIndex]} index={cardIndex} total={cards.length} />

          {/* Navigation */}
          <div className="flashcards-nav">
            <button className="btn btn--ghost" onClick={handlePrev} disabled={cardIndex === 0}>
              <ChevronLeft size={18} /> Previous
            </button>
            <button className="btn btn--ghost btn--sm" onClick={handleReset} title="Back to first card">
              <RotateCcw size={14} />
            </button>
            <button className="btn btn--primary" onClick={handleNext} disabled={cardIndex === cards.length - 1}>
              Next <ChevronRight size={18} />
            </button>
          </div>

          {/* Card grid overview */}
          <div className="flashcards-dots">
            {cards.map((_, i) => (
              <button
                key={i}
                className={`flashcards-dot ${i === cardIndex ? 'flashcards-dot--active' : ''}`}
                onClick={() => setCardIndex(i)}
                title={`Card ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && cards.length === 0 && selectedTopic && (
        <div className="card empty-state-card">
          <div className="empty-state">
            <span style={{ fontSize: '3rem' }}>🎴</span>
            <h3>No flashcards yet</h3>
            <p>Click <strong>Generate Flashcards</strong> to create memorization cards from <strong>{selectedTopic.name}</strong>.</p>
          </div>
        </div>
      )}
    </div>
  );
}
