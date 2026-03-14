import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, RotateCcw, Layers, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { generateFlashcards, type Flashcard } from '../services/geminiService';
import { incrementAiInteraction, completeTopicStep } from '../services/storage';
import FlashCard from '../components/FlashCard';
import { SkeletonCard } from '../components/SkeletonLoader';
import { clearPendingAction, getPendingAction } from '../services/intentSystem';
import { useTopicContext } from '../context/TopicContext';

export default function FlashcardsPage() {
  const {
    topics,
    currentTopic,
    setCurrentTopicById,
    appendFlashcards,
    addFlashcard,
    editFlashcard,
    deleteFlashcard,
  } = useTopicContext();

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(() => currentTopic?.id ?? topics[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const commandRanRef = useRef(false);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [topics, selectedTopicId]
  );

  const cards: Flashcard[] = selectedTopic?.flashcards ?? [];

  useEffect(() => {
    if (currentTopic?.id && currentTopic.id !== selectedTopicId) {
      setSelectedTopicId(currentTopic.id);
    }
  }, [currentTopic?.id, selectedTopicId]);

  useEffect(() => {
    if (cardIndex >= cards.length && cards.length > 0) {
      setCardIndex(cards.length - 1);
    }
    if (cards.length === 0) {
      setCardIndex(0);
    }
  }, [cards.length, cardIndex]);

  const handleGenerate = useCallback(async (topicIdOverride?: string, count: number = 8) => {
    const effectiveTopicId = topicIdOverride ?? selectedTopic?.id;
    const effectiveTopic = topics.find((topic) => topic.id === effectiveTopicId) ?? null;
    if (!effectiveTopic) return;

    setLoading(true);
    setError(null);
    try {
      const generated = await generateFlashcards(effectiveTopic.name, count);
      incrementAiInteraction();
      appendFlashcards(effectiveTopic.id, generated);
      completeTopicStep(effectiveTopic.id, 'flashcards');
      if (cards.length === 0) setCardIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards.');
    } finally {
      setLoading(false);
    }
  }, [appendFlashcards, cards.length, selectedTopic?.id, topics]);

  useEffect(() => {
    if (commandRanRef.current) return;
    const pending = getPendingAction();
    if (!pending) return;

    const flashcardIntents = ['generate_flashcards', 'add_flashcard', 'delete_flashcard', 'edit_flashcard'];
    if (!flashcardIntents.includes(pending.intent)) return;

    commandRanRef.current = true;

    const matchingTopic = pending.topic
      ? topics.find((topic) => topic.name.toLowerCase().trim() === pending.topic?.toLowerCase().trim())
      : selectedTopic;

    if (matchingTopic) {
      setSelectedTopicId(matchingTopic.id);
      setCurrentTopicById(matchingTopic.id);
    }

    const runPendingAction = async () => {
      if (!matchingTopic) {
        clearPendingAction();
        return;
      }

      if (pending.intent === 'generate_flashcards') {
        await handleGenerate(matchingTopic.id, 8);
      } else if (pending.intent === 'add_flashcard') {
        if (pending.flashcardQuestion && pending.flashcardAnswer) {
          const updated = addFlashcard(matchingTopic.id, pending.flashcardQuestion, pending.flashcardAnswer);
          if (!updated) {
            setError('Could not add the flashcard. Please try again.');
          }
        } else {
          await handleGenerate(matchingTopic.id, 3);
        }
      } else if (pending.intent === 'delete_flashcard') {
        const idx = pending.flashcardIndex ? pending.flashcardIndex - 1 : null;
        if (idx !== null && idx >= 0) {
          const target = matchingTopic.flashcards[idx];
          if (target) {
            deleteFlashcard(matchingTopic.id, target.id);
          }
        }
      } else if (pending.intent === 'edit_flashcard') {
        const idx = pending.flashcardIndex ? pending.flashcardIndex - 1 : null;
        if (idx !== null && idx >= 0) {
          const target = matchingTopic.flashcards[idx];
          if (target) {
            const updatedQuestion = pending.flashcardQuestion ?? target.question;
            const updatedAnswer = pending.flashcardAnswer ?? target.answer;
            editFlashcard(matchingTopic.id, target.id, {
              question: updatedQuestion,
              answer: updatedAnswer,
            });
          }
        }
      }

      clearPendingAction();
    };

    void runPendingAction();
  }, [addFlashcard, deleteFlashcard, editFlashcard, handleGenerate, selectedTopic, setCurrentTopicById, topics]);

  function handlePrev() {
    setCardIndex((i) => Math.max(0, i - 1));
  }

  function handleNext() {
    setCardIndex((i) => Math.min(cards.length - 1, i + 1));
  }

  function handleReset() {
    setCardIndex(0);
  }

  function openEdit(card: Flashcard) {
    setEditingCardId(card.id);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
  }

  function handleSaveEdit() {
    if (!selectedTopic || !editingCardId) return;
    const updated = editFlashcard(selectedTopic.id, editingCardId, {
      question: editQuestion,
      answer: editAnswer,
    });
    if (!updated) {
      setError('Could not save edits for this flashcard.');
      return;
    }
    setEditingCardId(null);
    setEditQuestion('');
    setEditAnswer('');
  }

  function handleCreateManual() {
    if (!selectedTopic) return;
    const updated = addFlashcard(selectedTopic.id, newQuestion, newAnswer);
    if (!updated) {
      setError('Please enter both question and answer.');
      return;
    }
    setNewQuestion('');
    setNewAnswer('');
    setIsCreating(false);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Flashcards</h1>
        <p className="page-subtitle">Click a card to flip it. Add, edit, and delete cards anytime.</p>
      </div>

      <div className="card">
        <div className="input-row">
          <select
            className="select-input"
            value={selectedTopicId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedTopicId(id);
              setCurrentTopicById(id);
              setCardIndex(0);
            }}
          >
            {topics.length === 0 && <option value="">Please create or select a topic first.</option>}
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </select>
          <button
            className="btn btn--primary"
            onClick={() => void handleGenerate()}
            disabled={loading || !selectedTopic}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Layers size={16} />}
            <span>{loading ? 'Generating...' : cards.length > 0 ? 'Generate More' : 'Generate Flashcards'}</span>
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => setIsCreating((value) => !value)}
            disabled={!selectedTopic}
          >
            <Plus size={16} />
            <span>{isCreating ? 'Close' : 'Add Manually'}</span>
          </button>
        </div>
      </div>

      {isCreating && selectedTopic && (
        <div className="card">
          <div className="input-row" style={{ marginBottom: '0.75rem' }}>
            <input
              className="text-input"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Question"
            />
          </div>
          <div className="input-row">
            <textarea
              className="text-input"
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Answer"
              rows={3}
            />
          </div>
          <div className="input-row" style={{ marginTop: '0.75rem' }}>
            <button className="btn btn--primary" onClick={handleCreateManual}>
              <Save size={16} />
              <span>Add Flashcard</span>
            </button>
            <button className="btn btn--ghost" onClick={() => setIsCreating(false)}>
              <X size={16} />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="flashcards-skeleton">
          <SkeletonCard />
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div className="flashcards-viewer">
          <div className="flashcards-progress">
            <div className="flashcards-progress__bar">
              <div
                className="flashcards-progress__fill"
                style={{ width: `${((cardIndex + 1) / cards.length) * 100}%` }}
              />
            </div>
            <span className="flashcards-progress__label">{cardIndex + 1} / {cards.length}</span>
          </div>

          <FlashCard card={cards[cardIndex]} index={cardIndex} total={cards.length} />

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

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card__header">
              <h3 className="card__title">Manage Current Flashcard</h3>
            </div>
            <div className="input-row">
              <button className="btn btn--secondary" onClick={() => openEdit(cards[cardIndex])}>
                <Pencil size={14} />
                <span>Edit</span>
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  if (!selectedTopic) return;
                  deleteFlashcard(selectedTopic.id, cards[cardIndex].id);
                }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {editingCardId && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card__header">
                <h3 className="card__title">Edit Flashcard</h3>
              </div>
              <div className="input-row" style={{ marginBottom: '0.75rem' }}>
                <input
                  className="text-input"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  placeholder="Question"
                />
              </div>
              <div className="input-row">
                <textarea
                  className="text-input"
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  placeholder="Answer"
                  rows={3}
                />
              </div>
              <div className="input-row" style={{ marginTop: '0.75rem' }}>
                <button className="btn btn--success" onClick={handleSaveEdit}>
                  <Save size={16} />
                  <span>Save Changes</span>
                </button>
                <button className="btn btn--ghost" onClick={() => setEditingCardId(null)}>
                  <X size={16} />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && cards.length === 0 && selectedTopic && (
        <div className="card empty-state-card">
          <div className="empty-state">
            <span style={{ fontSize: '3rem' }}>🎴</span>
            <h3>No flashcards yet</h3>
            <p>Generate flashcards for <strong>{selectedTopic.name}</strong> to start memorizing key concepts.</p>
          </div>
        </div>
      )}
    </div>
  );
}
