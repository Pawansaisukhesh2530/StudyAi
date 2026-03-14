import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Topic {
  id: string;
  name: string;
  explanation: string;
  notes: string | null;
  quizzes: QuizQuestion[];
  flashcards: Flashcard[];
  completedSteps: string[];
  diagram: string | null;
  timestamp: number;
  createdAt: number;
  updatedAt: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  createdAt?: number;
  updatedAt?: number;
}

interface RemoteFlashcardRecord {
  id: string;
  userId: string;
  topicId: string;
  topicName: string;
  question: string;
  answer: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Quiz {
  id: string;
  topic: string;
  questions: QuizQuestion[];
  score: number | null;
  totalQuestions: number;
  completedAt: number | null;
  createdAt: number;
}

export interface Note {
  id: string;
  topic: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProgressStats {
  topicsStudied: number;
  quizzesCompleted: number;
  notesCreated: number;
  aiInteractions: number;
  averageQuizScore: number;
  studyStreak: number;
  lastStudyDate: string | null;
  conceptsLearned: number;
}

const CONV_KEY = 'studyai_conversations';
const TOPICS_KEY = 'studyai_topics';
const ACTIVE_TOPIC_KEY = 'studyai_active_topic_id';
const QUIZZES_KEY = 'studyai_quizzes';
const NOTES_KEY = 'studyai_notes';
const STATS_KEY = 'studyai_stats';

const COLLECTIONS = {
  users: 'users',
  conversations: 'conversations',
  topics: 'topics',
  flashcards: 'flashcards',
  quizzes: 'quizzes',
  notes: 'notes',
  progress: 'progress',
} as const;

type CollectionName = Exclude<keyof typeof COLLECTIONS, 'users'>;

let storageScopeUser: string | null = null;

interface LegacyChatMessage {
  id?: string;
  role?: 'user' | 'model' | 'assistant';
  parts?: string;
  content?: string;
  timestamp?: number;
}

interface LegacyConversation {
  id?: string;
  title?: string;
  messages?: LegacyChatMessage[];
  createdAt?: number;
  updatedAt?: number;
}

interface LegacyTopic {
  id?: string;
  name?: string;
  explanation?: string;
  notes?: string | null;
  quizzes?: QuizQuestion[];
  flashcards?: Flashcard[];
  completedSteps?: string[];
  diagram?: string | null;
  timestamp?: number;
  createdAt?: number;
  updatedAt?: number;
}

interface LegacyFlashcard {
  id?: string;
  question?: string;
  answer?: string;
  front?: string;
  back?: string;
  createdAt?: number;
  updatedAt?: number;
}

function now(): number {
  return Date.now();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeFlashcard(card: LegacyFlashcard, idx: number): Flashcard {
  const question = card.question ?? card.front ?? '';
  const answer = card.answer ?? card.back ?? '';
  const createdAt = card.createdAt ?? now();
  return {
    id: card.id ?? `${now()}-card-${idx}`,
    question,
    answer,
    createdAt,
    updatedAt: card.updatedAt ?? createdAt,
  };
}

function currentScopeUser(): string | null {
  return storageScopeUser;
}

function scopedKey(baseKey: string): string {
  const user = currentScopeUser();
  return user ? `${baseKey}:${user}` : `${baseKey}:guest`;
}

function readScopedRaw(baseKey: string): string | null {
  const exact = localStorage.getItem(scopedKey(baseKey));
  if (exact) return exact;

  if (!currentScopeUser()) {
    const legacy = localStorage.getItem(baseKey);
    if (legacy) {
      localStorage.setItem(scopedKey(baseKey), legacy);
      return legacy;
    }
  }

  return null;
}

function writeScopedRaw(baseKey: string, value: string): void {
  localStorage.setItem(scopedKey(baseKey), value);
}

function removeScopedRaw(baseKey: string): void {
  localStorage.removeItem(scopedKey(baseKey));
}

function normalizeMessage(msg: LegacyChatMessage, idx: number): ChatMessage {
  const role = msg.role === 'model' ? 'assistant' : msg.role === 'user' ? 'user' : 'assistant';
  return {
    id: msg.id ?? `${now()}-${idx}`,
    role,
    content: msg.content ?? msg.parts ?? '',
    timestamp: msg.timestamp ?? now(),
  };
}

function normalizeConversation(conv: LegacyConversation, idx: number): Conversation {
  const createdAt = conv.createdAt ?? now();
  return {
    id: conv.id ?? `${now()}-conv-${idx}`,
    title: conv.title ?? 'New Conversation',
    messages: (conv.messages ?? []).map(normalizeMessage),
    createdAt,
    updatedAt: conv.updatedAt ?? createdAt,
  };
}

function normalizeTopic(topic: LegacyTopic, idx: number): Topic {
  const created = topic.createdAt ?? topic.timestamp ?? now();
  return {
    id: topic.id ?? `${now()}-topic-${idx}`,
    name: topic.name ?? 'Untitled Topic',
    explanation: topic.explanation ?? '',
    notes: topic.notes ?? null,
    quizzes: Array.isArray(topic.quizzes) ? topic.quizzes : [],
    flashcards: Array.isArray(topic.flashcards) ? topic.flashcards.map(normalizeFlashcard) : [],
    completedSteps: Array.isArray(topic.completedSteps) ? topic.completedSteps : [],
    diagram: topic.diagram ?? null,
    timestamp: topic.timestamp ?? created,
    createdAt: created,
    updatedAt: topic.updatedAt ?? created,
  };
}

function writeConversations(conversations: Conversation[]): void {
  writeScopedRaw(CONV_KEY, JSON.stringify(conversations));
}

function writeTopics(topics: Topic[]): void {
  writeScopedRaw(TOPICS_KEY, JSON.stringify(topics));
}

function writeQuizzes(quizzes: Quiz[]): void {
  writeScopedRaw(QUIZZES_KEY, JSON.stringify(quizzes));
}

function writeNotes(notes: Note[]): void {
  writeScopedRaw(NOTES_KEY, JSON.stringify(notes));
}

function writeStats(stats: ProgressStats): void {
  writeScopedRaw(STATS_KEY, JSON.stringify(stats));
}

async function upsertRemote(collectionName: CollectionName, id: string, payload: Record<string, unknown>): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const userId = currentScopeUser();
  if (!userId) return;

  await setDoc(
    doc(db, COLLECTIONS[collectionName], id),
    {
      ...payload,
      id,
      userId,
      updatedAt: now(),
    },
    { merge: true }
  );
}

async function deleteRemote(collectionName: CollectionName, id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const userId = currentScopeUser();
  if (!userId) return;

  await deleteDoc(doc(db, COLLECTIONS[collectionName], id));
}

async function deleteRemoteFlashcardsForTopic(topicId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const firestore = db;
  const userId = currentScopeUser();
  if (!userId) return;

  const q = query(
    collection(firestore, COLLECTIONS.flashcards),
    where('userId', '==', userId),
    where('topicId', '==', topicId)
  );
  const snapshot = await getDocs(q);
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(doc(firestore, COLLECTIONS.flashcards, docSnap.id))));
}

async function syncTopicFlashcards(topicId: string, topicName: string, cards: Flashcard[]): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const firestore = db;
  const userId = currentScopeUser();
  if (!userId) return;

  const existingQuery = query(
    collection(firestore, COLLECTIONS.flashcards),
    where('userId', '==', userId),
    where('topicId', '==', topicId)
  );
  const existingSnapshot = await getDocs(existingQuery);
  const keepIds = new Set(cards.map((card) => card.id));

  const deletes = existingSnapshot.docs
    .filter((docSnap) => !keepIds.has(docSnap.id))
    .map((docSnap) => deleteDoc(doc(firestore, COLLECTIONS.flashcards, docSnap.id)));

  const writes = cards.map((card) => {
    const cardCreatedAt = card.createdAt ?? now();
    return setDoc(
      doc(firestore, COLLECTIONS.flashcards, card.id),
      {
        id: card.id,
        userId,
        topicId,
        topicName,
        question: card.question,
        answer: card.answer,
        createdAt: cardCreatedAt,
        updatedAt: now(),
      },
      { merge: true }
    );
  });

  await Promise.all([...deletes, ...writes]);
}

async function fetchRemoteCollection<T>(collectionName: CollectionName): Promise<T[]> {
  if (!isFirebaseConfigured || !db) return [];
  const userId = currentScopeUser();
  if (!userId) return [];

  const q = query(collection(db, COLLECTIONS[collectionName]), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => docSnap.data() as T);
}

export function setStorageScopeUser(userId: string | null): void {
  storageScopeUser = userId;
}

export async function initializeUserDataSync(
  userId: string,
  profile?: { email?: string | null; name?: string | null }
): Promise<void> {
  setStorageScopeUser(userId);

  if (!isFirebaseConfigured || !db) return;

  await setDoc(
    doc(db, COLLECTIONS.users, userId),
    {
      id: userId,
      email: profile?.email ?? null,
      name: profile?.name ?? null,
      lastSeenAt: now(),
      updatedAt: now(),
    },
    { merge: true }
  );

  const [conversations, topics, quizzes, notes, progress, flashcards] = await Promise.all([
    fetchRemoteCollection<Conversation>('conversations'),
    fetchRemoteCollection<Topic>('topics'),
    fetchRemoteCollection<Quiz>('quizzes'),
    fetchRemoteCollection<Note>('notes'),
    fetchRemoteCollection<ProgressStats>('progress'),
    fetchRemoteCollection<RemoteFlashcardRecord>('flashcards'),
  ]);

  if (conversations.length > 0) {
    writeConversations(conversations.sort((a, b) => b.updatedAt - a.updatedAt));
  }
  if (topics.length > 0) {
    const cardsByTopic = new Map<string, Flashcard[]>();
    flashcards.forEach((card, idx) => {
      if (!card.topicId) return;
      const normalized = normalizeFlashcard(card, idx);
      const existing = cardsByTopic.get(card.topicId) ?? [];
      cardsByTopic.set(card.topicId, [...existing, normalized]);
    });

    const merged = topics
      .map((topic, idx) => normalizeTopic(topic, idx))
      .map((topic) => {
        const remoteCards = cardsByTopic.get(topic.id);
        if (!remoteCards || remoteCards.length === 0) return topic;
        return {
          ...topic,
          flashcards: remoteCards,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    writeTopics(merged);
  }
  if (quizzes.length > 0) {
    writeQuizzes(quizzes.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
  }
  if (notes.length > 0) {
    writeNotes(notes.sort((a, b) => b.updatedAt - a.updatedAt));
  }
  if (progress.length > 0) {
    writeStats(progress[0]);
  }
}

export function clearLocalDataForCurrentScope(): void {
  removeScopedRaw(CONV_KEY);
  removeScopedRaw(TOPICS_KEY);
  removeScopedRaw(QUIZZES_KEY);
  removeScopedRaw(NOTES_KEY);
  removeScopedRaw(STATS_KEY);
  removeScopedRaw(ACTIVE_TOPIC_KEY);
}

export function getConversations(): Conversation[] {
  const raw = readScopedRaw(CONV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LegacyConversation[];
    return parsed.map(normalizeConversation);
  } catch {
    return [];
  }
}

export function saveConversation(conv: Conversation): void {
  const next = [conv, ...getConversations().filter((c) => c.id !== conv.id)];
  writeConversations(next);
  void upsertRemote('conversations', conv.id, conv as unknown as Record<string, unknown>);
}

export function createConversation(): Conversation {
  return {
    id: generateId(),
    title: 'New Conversation',
    messages: [],
    createdAt: now(),
    updatedAt: now(),
  };
}

export function deleteConversation(id: string): void {
  const convs = getConversations().filter((c) => c.id !== id);
  writeConversations(convs);
  void deleteRemote('conversations', id);
}

export function getTopics(): Topic[] {
  const raw = readScopedRaw(TOPICS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LegacyTopic[];
    return parsed.map(normalizeTopic);
  } catch {
    return [];
  }
}

export function saveTopic(
  topic: Omit<Topic, 'id' | 'createdAt' | 'updatedAt' | 'timestamp' | 'notes' | 'quizzes' | 'flashcards' | 'completedSteps' | 'diagram'> &
    Partial<Pick<Topic, 'notes' | 'quizzes' | 'flashcards' | 'completedSteps' | 'diagram'>>
): Topic {
  const topics = getTopics();
  const tNow = now();
  const newTopic: Topic = {
    ...topic,
    notes: topic.notes ?? null,
    quizzes: topic.quizzes ?? [],
    flashcards: topic.flashcards ?? [],
    completedSteps: topic.completedSteps ?? [],
    diagram: topic.diagram ?? null,
    id: generateId(),
    timestamp: tNow,
    createdAt: tNow,
    updatedAt: tNow,
  };
  writeTopics([newTopic, ...topics]);
  incrementStat('topicsStudied');
  void upsertRemote('topics', newTopic.id, newTopic as unknown as Record<string, unknown>);
  if (newTopic.flashcards.length > 0) {
    void syncTopicFlashcards(newTopic.id, newTopic.name, newTopic.flashcards);
  }
  return newTopic;
}

export function updateTopic(
  id: string,
  updates: Partial<Pick<Topic, 'name' | 'explanation' | 'notes' | 'quizzes' | 'flashcards' | 'completedSteps' | 'diagram'>>
): Topic | null {
  const topics = getTopics();
  const idx = topics.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  topics[idx] = {
    ...topics[idx],
    ...updates,
    updatedAt: now(),
  };
  writeTopics(topics);
  void upsertRemote('topics', id, topics[idx] as unknown as Record<string, unknown>);
  if (updates.flashcards) {
    void syncTopicFlashcards(id, topics[idx].name, topics[idx].flashcards);
  }
  return topics[idx];
}

function normalizeFlashcardsInput(cards: Array<Partial<Flashcard> & { front?: string; back?: string }>): Flashcard[] {
  return cards
    .map((card, idx) => normalizeFlashcard(card, idx))
    .filter((card) => card.question.trim() && card.answer.trim());
}

export function appendTopicFlashcards(
  topicId: string,
  cards: Array<Partial<Flashcard> & { front?: string; back?: string }>
): Topic | null {
  const topic = getTopics().find((item) => item.id === topicId);
  if (!topic) return null;

  const additions = normalizeFlashcardsInput(cards).map((card) => ({
    ...card,
    id: card.id || generateId(),
    createdAt: card.createdAt ?? now(),
    updatedAt: now(),
  }));

  if (additions.length === 0) return topic;

  return updateTopic(topicId, {
    flashcards: [...topic.flashcards, ...additions],
  });
}

export function addFlashcardToTopic(topicId: string, question: string, answer: string): Topic | null {
  const cleanedQuestion = question.trim();
  const cleanedAnswer = answer.trim();
  if (!cleanedQuestion || !cleanedAnswer) return null;

  return appendTopicFlashcards(topicId, [
    {
      id: generateId(),
      question: cleanedQuestion,
      answer: cleanedAnswer,
      createdAt: now(),
      updatedAt: now(),
    },
  ]);
}

export function updateFlashcardInTopic(
  topicId: string,
  flashcardId: string,
  updates: Partial<Pick<Flashcard, 'question' | 'answer'>>
): Topic | null {
  const topic = getTopics().find((item) => item.id === topicId);
  if (!topic) return null;

  const nextCards = topic.flashcards.map((card) => {
    if (card.id !== flashcardId) return card;
    return {
      ...card,
      question: updates.question?.trim() ?? card.question,
      answer: updates.answer?.trim() ?? card.answer,
      updatedAt: now(),
    };
  });

  return updateTopic(topicId, { flashcards: nextCards });
}

export function deleteFlashcardFromTopic(topicId: string, flashcardId: string): Topic | null {
  const topic = getTopics().find((item) => item.id === topicId);
  if (!topic) return null;

  const nextCards = topic.flashcards.filter((card) => card.id !== flashcardId);
  const updated = updateTopic(topicId, { flashcards: nextCards });
  void deleteRemote('flashcards', flashcardId);
  return updated;
}

export function upsertTopicFromExplanation(name: string, explanation: string): Topic {
  const topics = getTopics();
  const normalizedName = name.trim().toLowerCase();
  const existing = topics.find((t) => t.name.trim().toLowerCase() === normalizedName);
  if (existing) {
    const updated = updateTopic(existing.id, { explanation });
    if (!updated) return existing;
    return updated;
  }
  return saveTopic({ name: name.trim(), explanation });
}

export function setActiveTopic(id: string | null): void {
  if (!id) {
    removeScopedRaw(ACTIVE_TOPIC_KEY);
    return;
  }
  writeScopedRaw(ACTIVE_TOPIC_KEY, id);
}

export function getActiveTopicId(): string | null {
  return readScopedRaw(ACTIVE_TOPIC_KEY);
}

export function getActiveTopic(): Topic | null {
  const id = getActiveTopicId();
  if (!id) return null;
  return getTopics().find((t) => t.id === id) ?? null;
}

export function deleteTopic(id: string): void {
  const topics = getTopics().filter((t) => t.id !== id);
  writeTopics(topics);
  if (getActiveTopicId() === id) {
    setActiveTopic(topics.length > 0 ? topics[0].id : null);
  }
  void deleteRemote('topics', id);
  void deleteRemoteFlashcardsForTopic(id);
}

export function getQuizzes(): Quiz[] {
  const raw = readScopedRaw(QUIZZES_KEY);
  return raw ? (JSON.parse(raw) as Quiz[]) : [];
}

export function saveQuiz(quiz: Quiz): void {
  const quizzes = [quiz, ...getQuizzes().filter((q) => q.id !== quiz.id)];
  writeQuizzes(quizzes);
  void upsertRemote('quizzes', quiz.id, quiz as unknown as Record<string, unknown>);
}

export function createQuiz(topic: string, questions: QuizQuestion[]): Quiz {
  const quiz: Quiz = {
    id: generateId(),
    topic,
    questions,
    score: null,
    totalQuestions: questions.length,
    completedAt: null,
    createdAt: now(),
  };
  saveQuiz(quiz);
  return quiz;
}

export function completeQuiz(id: string, score: number): void {
  const quizzes = getQuizzes();
  const idx = quizzes.findIndex((q) => q.id === id);
  if (idx !== -1) {
    quizzes[idx].score = score;
    quizzes[idx].completedAt = now();
    writeQuizzes(quizzes);
    void upsertRemote('quizzes', id, quizzes[idx] as unknown as Record<string, unknown>);
    incrementStat('quizzesCompleted');
  }
}

export function deleteQuiz(id: string): void {
  const quizzes = getQuizzes().filter((q) => q.id !== id);
  writeQuizzes(quizzes);
  void deleteRemote('quizzes', id);
}

export function getNotes(): Note[] {
  const raw = readScopedRaw(NOTES_KEY);
  return raw ? (JSON.parse(raw) as Note[]) : [];
}

export function saveNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
  const notes = getNotes();
  const newNote: Note = {
    ...note,
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
  };
  writeNotes([newNote, ...notes]);
  incrementStat('notesCreated');
  void upsertRemote('notes', newNote.id, newNote as unknown as Record<string, unknown>);
  return newNote;
}

export function updateNote(id: string, content: string): void {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx !== -1) {
    notes[idx].content = content;
    notes[idx].updatedAt = now();
    writeNotes(notes);
    void upsertRemote('notes', id, notes[idx] as unknown as Record<string, unknown>);
  }
}

export function deleteNote(id: string): void {
  const notes = getNotes().filter((n) => n.id !== id);
  writeNotes(notes);
  void deleteRemote('notes', id);
}

export function getStats(): ProgressStats {
  const raw = readScopedRaw(STATS_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as Partial<ProgressStats>;
    return {
      topicsStudied: parsed.topicsStudied ?? 0,
      quizzesCompleted: parsed.quizzesCompleted ?? 0,
      notesCreated: parsed.notesCreated ?? 0,
      aiInteractions: parsed.aiInteractions ?? 0,
      averageQuizScore: parsed.averageQuizScore ?? 0,
      studyStreak: parsed.studyStreak ?? 0,
      lastStudyDate: parsed.lastStudyDate ?? null,
      conceptsLearned: parsed.conceptsLearned ?? 0,
    };
  }
  return {
    topicsStudied: 0,
    quizzesCompleted: 0,
    notesCreated: 0,
    aiInteractions: 0,
    averageQuizScore: 0,
    studyStreak: 0,
    lastStudyDate: null,
    conceptsLearned: 0,
  };
}

function persistStats(stats: ProgressStats): void {
  writeStats(stats);
  const userId = currentScopeUser();
  if (userId) {
    void upsertRemote('progress', userId, stats as unknown as Record<string, unknown>);
  }
}

export function incrementStat(key: keyof Omit<ProgressStats, 'averageQuizScore' | 'lastStudyDate' | 'studyStreak' | 'conceptsLearned'>): void {
  const stats = getStats();
  stats[key] = (stats[key] as number) + 1;
  const completed = getQuizzes().filter((q) => q.score !== null);
  if (completed.length > 0) {
    const total = completed.reduce((sum, q) => sum + (q.score ?? 0), 0);
    stats.averageQuizScore = Math.round(total / completed.length);
  }
  persistStats(stats);
}

export function incrementAiInteraction(): void {
  incrementStat('aiInteractions');
  touchStudyStreak();
}

export function touchStudyStreak(): void {
  const stats = getStats();
  const today = new Date().toISOString().slice(0, 10);
  if (stats.lastStudyDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (stats.lastStudyDate === yesterday) {
    stats.studyStreak = (stats.studyStreak || 0) + 1;
  } else {
    stats.studyStreak = 1;
  }
  stats.lastStudyDate = today;
  persistStats(stats);
}

export function incrementConceptsLearned(count: number = 1): void {
  const stats = getStats();
  stats.conceptsLearned = (stats.conceptsLearned || 0) + count;
  persistStats(stats);
}

export function completeTopicStep(topicId: string, step: string): void {
  const topic = getTopics().find((t) => t.id === topicId);
  if (!topic) return;
  const completedSteps = topic.completedSteps ?? [];
  if (!completedSteps.includes(step)) {
    updateTopic(topicId, { completedSteps: [...completedSteps, step] });
  }
}

export function getTopicsMastered(): number {
  const quizzes = getQuizzes();
  const masteredTopics = new Set<string>();
  quizzes.forEach((q) => {
    if (q.score !== null && q.score >= 70) masteredTopics.add(q.topic.toLowerCase().trim());
  });
  return masteredTopics.size;
}
