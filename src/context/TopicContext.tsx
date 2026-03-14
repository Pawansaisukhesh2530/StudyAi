import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  addFlashcardToTopic,
  appendTopicFlashcards,
  deleteFlashcardFromTopic,
  deleteTopic,
  getActiveTopicId,
  getTopics,
  setActiveTopic,
  updateFlashcardInTopic,
  updateTopic,
  upsertTopicFromExplanation,
  type Flashcard,
  type QuizQuestion,
  type Topic,
} from '../services/storage';

interface TopicContextValue {
  topics: Topic[];
  currentTopic: Topic | null;
  currentTopicId: string | null;
  flashcards: Flashcard[];
  notes: string | null;
  quizzes: QuizQuestion[];
  refreshTopics: () => void;
  setCurrentTopicById: (id: string | null) => void;
  upsertTopicExplanation: (name: string, explanation: string) => Topic;
  updateTopicById: (
    id: string,
    updates: Partial<Pick<Topic, 'name' | 'explanation' | 'notes' | 'quizzes' | 'flashcards' | 'completedSteps' | 'diagram'>>
  ) => Topic | null;
  appendFlashcards: (topicId: string, cards: Array<Partial<Flashcard> & { front?: string; back?: string }>) => Topic | null;
  addFlashcard: (topicId: string, question: string, answer: string) => Topic | null;
  editFlashcard: (topicId: string, flashcardId: string, updates: Partial<Pick<Flashcard, 'question' | 'answer'>>) => Topic | null;
  deleteFlashcard: (topicId: string, flashcardId: string) => Topic | null;
  removeTopic: (topicId: string) => void;
}

const TopicContext = createContext<TopicContextValue | null>(null);

function resolveCurrentTopic(topics: Topic[], activeId: string | null): Topic | null {
  if (activeId) {
    const exact = topics.find((topic) => topic.id === activeId);
    if (exact) return exact;
  }
  return topics[0] ?? null;
}

export function TopicProvider({ children }: { children: React.ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>(() => getTopics());
  const [currentTopicId, setCurrentTopicIdState] = useState<string | null>(() => getActiveTopicId());

  const refreshTopics = useCallback(() => {
    const nextTopics = getTopics();
    setTopics(nextTopics);

    const current = resolveCurrentTopic(nextTopics, getActiveTopicId() ?? currentTopicId);
    if (current) {
      setActiveTopic(current.id);
      setCurrentTopicIdState(current.id);
      return;
    }

    setActiveTopic(null);
    setCurrentTopicIdState(null);
  }, [currentTopicId]);

  const setCurrentTopicById = useCallback((id: string | null) => {
    setActiveTopic(id);
    setCurrentTopicIdState(id);
    setTopics(getTopics());
  }, []);

  const upsertTopicExplanation = useCallback((name: string, explanation: string): Topic => {
    const topic = upsertTopicFromExplanation(name, explanation);
    setActiveTopic(topic.id);
    setCurrentTopicIdState(topic.id);
    setTopics(getTopics());
    return topic;
  }, []);

  const updateTopicById = useCallback<
    TopicContextValue['updateTopicById']
  >((id, updates) => {
    const updated = updateTopic(id, updates);
    setTopics(getTopics());
    if (updated) {
      setActiveTopic(updated.id);
      setCurrentTopicIdState(updated.id);
    }
    return updated;
  }, []);

  const appendFlashcards = useCallback<TopicContextValue['appendFlashcards']>((topicId, cards) => {
    const updated = appendTopicFlashcards(topicId, cards);
    setTopics(getTopics());
    if (updated) {
      setActiveTopic(updated.id);
      setCurrentTopicIdState(updated.id);
    }
    return updated;
  }, []);

  const addFlashcard = useCallback<TopicContextValue['addFlashcard']>((topicId, question, answer) => {
    const updated = addFlashcardToTopic(topicId, question, answer);
    setTopics(getTopics());
    if (updated) {
      setActiveTopic(updated.id);
      setCurrentTopicIdState(updated.id);
    }
    return updated;
  }, []);

  const editFlashcard = useCallback<TopicContextValue['editFlashcard']>((topicId, flashcardId, updates) => {
    const updated = updateFlashcardInTopic(topicId, flashcardId, updates);
    setTopics(getTopics());
    return updated;
  }, []);

  const deleteFlashcard = useCallback<TopicContextValue['deleteFlashcard']>((topicId, flashcardId) => {
    const updated = deleteFlashcardFromTopic(topicId, flashcardId);
    setTopics(getTopics());
    return updated;
  }, []);

  const removeTopic = useCallback((topicId: string) => {
    deleteTopic(topicId);
    const next = getTopics();
    setTopics(next);
    const active = resolveCurrentTopic(next, getActiveTopicId());
    setCurrentTopicIdState(active?.id ?? null);
  }, []);

  const currentTopic = useMemo(
    () => resolveCurrentTopic(topics, currentTopicId),
    [topics, currentTopicId]
  );

  const value = useMemo<TopicContextValue>(() => ({
    topics,
    currentTopic,
    currentTopicId: currentTopic?.id ?? null,
    flashcards: currentTopic?.flashcards ?? [],
    notes: currentTopic?.notes ?? null,
    quizzes: currentTopic?.quizzes ?? [],
    refreshTopics,
    setCurrentTopicById,
    upsertTopicExplanation,
    updateTopicById,
    appendFlashcards,
    addFlashcard,
    editFlashcard,
    deleteFlashcard,
    removeTopic,
  }), [
    topics,
    currentTopic,
    refreshTopics,
    setCurrentTopicById,
    upsertTopicExplanation,
    updateTopicById,
    appendFlashcards,
    addFlashcard,
    editFlashcard,
    deleteFlashcard,
    removeTopic,
  ]);

  return <TopicContext.Provider value={value}>{children}</TopicContext.Provider>;
}

export function useTopicContext(): TopicContextValue {
  const ctx = useContext(TopicContext);
  if (!ctx) throw new Error('useTopicContext must be used within TopicProvider.');
  return ctx;
}
