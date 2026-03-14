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
  front: string;
  back: string;
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Conversations ────────────────────────────────────────────────────────────

const CONV_KEY = 'studyai_conversations';

interface LegacyChatMessage {
  id?: string;
  role?: 'user' | 'model' | 'assistant';
  parts?: string;
  content?: string;
  timestamp?: number;
}

interface LegacyConversation {
  id: string;
  title: string;
  messages: LegacyChatMessage[];
  createdAt: number;
  updatedAt: number;
}

function normalizeMessage(msg: LegacyChatMessage, idx: number): ChatMessage {
  const role = msg.role === 'model' ? 'assistant' : msg.role === 'user' ? 'user' : 'assistant';
  return {
    id: msg.id ?? `${Date.now()}-${idx}`,
    role,
    content: msg.content ?? msg.parts ?? '',
    timestamp: msg.timestamp ?? Date.now(),
  };
}

function normalizeConversation(conv: LegacyConversation): Conversation {
  return {
    id: conv.id,
    title: conv.title,
    messages: (conv.messages ?? []).map(normalizeMessage),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

export function getConversations(): Conversation[] {
  const raw = localStorage.getItem(CONV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LegacyConversation[];
    return parsed.map(normalizeConversation);
  } catch {
    return [];
  }
}

export function saveConversation(conv: Conversation): void {
  const convs = getConversations().filter((c) => c.id !== conv.id);
  localStorage.setItem(CONV_KEY, JSON.stringify([conv, ...convs]));
}

export function createConversation(): Conversation {
  return {
    id: generateId(),
    title: 'New Conversation',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function deleteConversation(id: string): void {
  const convs = getConversations().filter((c) => c.id !== id);
  localStorage.setItem(CONV_KEY, JSON.stringify(convs));
}

// ─── Topics ───────────────────────────────────────────────────────────────────

const TOPICS_KEY = 'studyai_topics';
const ACTIVE_TOPIC_KEY = 'studyai_active_topic_id';

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

function normalizeTopic(topic: LegacyTopic, idx: number): Topic {
  const created = topic.createdAt ?? topic.timestamp ?? Date.now();
  return {
    id: topic.id ?? `${Date.now()}-topic-${idx}`,
    name: topic.name ?? 'Untitled Topic',
    explanation: topic.explanation ?? '',
    notes: topic.notes ?? null,
    quizzes: Array.isArray(topic.quizzes) ? topic.quizzes : [],
    flashcards: Array.isArray(topic.flashcards) ? topic.flashcards : [],
    completedSteps: Array.isArray(topic.completedSteps) ? topic.completedSteps : [],
    diagram: topic.diagram ?? null,
    timestamp: topic.timestamp ?? created,
    createdAt: created,
    updatedAt: topic.updatedAt ?? created,
  };
}

export function getTopics(): Topic[] {
  const raw = localStorage.getItem(TOPICS_KEY);
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
  const now = Date.now();
  const newTopic: Topic = {
    ...topic,
    notes: topic.notes ?? null,
    quizzes: topic.quizzes ?? [],
    flashcards: topic.flashcards ?? [],
    completedSteps: topic.completedSteps ?? [],
    diagram: topic.diagram ?? null,
    id: generateId(),
    timestamp: now,
    createdAt: now,
    updatedAt: now,
  };
  localStorage.setItem(TOPICS_KEY, JSON.stringify([newTopic, ...topics]));
  incrementStat('topicsStudied');
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
    updatedAt: Date.now(),
  };
  localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
  return topics[idx];
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
  return saveTopic({ name: name.trim(), explanation, notes: null, quizzes: [] });
}

export function setActiveTopic(id: string | null): void {
  if (!id) {
    localStorage.removeItem(ACTIVE_TOPIC_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_TOPIC_KEY, id);
}

export function getActiveTopicId(): string | null {
  return localStorage.getItem(ACTIVE_TOPIC_KEY);
}

export function getActiveTopic(): Topic | null {
  const id = getActiveTopicId();
  if (!id) return null;
  return getTopics().find((t) => t.id === id) ?? null;
}

export function deleteTopic(id: string): void {
  const topics = getTopics().filter((t) => t.id !== id);
  localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
  if (getActiveTopicId() === id) {
    setActiveTopic(topics.length > 0 ? topics[0].id : null);
  }
}

// ─── Quizzes ──────────────────────────────────────────────────────────────────

const QUIZZES_KEY = 'studyai_quizzes';

export function getQuizzes(): Quiz[] {
  const raw = localStorage.getItem(QUIZZES_KEY);
  return raw ? (JSON.parse(raw) as Quiz[]) : [];
}

export function saveQuiz(quiz: Quiz): void {
  const quizzes = getQuizzes().filter((q) => q.id !== quiz.id);
  localStorage.setItem(QUIZZES_KEY, JSON.stringify([quiz, ...quizzes]));
}

export function createQuiz(topic: string, questions: QuizQuestion[]): Quiz {
  const quiz: Quiz = {
    id: generateId(),
    topic,
    questions,
    score: null,
    totalQuestions: questions.length,
    completedAt: null,
    createdAt: Date.now(),
  };
  saveQuiz(quiz);
  return quiz;
}

export function completeQuiz(id: string, score: number): void {
  const quizzes = getQuizzes();
  const idx = quizzes.findIndex((q) => q.id === id);
  if (idx !== -1) {
    quizzes[idx].score = score;
    quizzes[idx].completedAt = Date.now();
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
    incrementStat('quizzesCompleted');
  }
}

export function deleteQuiz(id: string): void {
  const quizzes = getQuizzes().filter((q) => q.id !== id);
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
}

// ─── Notes ────────────────────────────────────────────────────────────────────

const NOTES_KEY = 'studyai_notes';

export function getNotes(): Note[] {
  const raw = localStorage.getItem(NOTES_KEY);
  return raw ? (JSON.parse(raw) as Note[]) : [];
}

export function saveNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
  const notes = getNotes();
  const newNote: Note = {
    ...note,
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  localStorage.setItem(NOTES_KEY, JSON.stringify([newNote, ...notes]));
  incrementStat('notesCreated');
  return newNote;
}

export function updateNote(id: string, content: string): void {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx !== -1) {
    notes[idx].content = content;
    notes[idx].updatedAt = Date.now();
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }
}

export function deleteNote(id: string): void {
  const notes = getNotes().filter((n) => n.id !== id);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// ─── Progress Stats ───────────────────────────────────────────────────────────

const STATS_KEY = 'studyai_stats';

export function getStats(): ProgressStats {
  const raw = localStorage.getItem(STATS_KEY);
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

export function incrementStat(key: keyof Omit<ProgressStats, 'averageQuizScore' | 'lastStudyDate' | 'studyStreak' | 'conceptsLearned'>): void {
  const stats = getStats();
  stats[key] = (stats[key] as number) + 1;
  // Recalculate average quiz score
  const completed = getQuizzes().filter((q) => q.score !== null);
  if (completed.length > 0) {
    const total = completed.reduce((sum, q) => sum + (q.score ?? 0), 0);
    stats.averageQuizScore = Math.round(total / completed.length);
  }
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
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
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function incrementConceptsLearned(count: number = 1): void {
  const stats = getStats();
  stats.conceptsLearned = (stats.conceptsLearned || 0) + count;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
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
