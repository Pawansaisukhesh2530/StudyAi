export type StudyIntent =
  | 'generate_notes'
  | 'generate_quiz'
  | 'generate_flashcards'
  | 'explain_topic'
  | 'learning_mode'
  | 'save_topic'
  | 'chat';

export interface IntentResult {
  intent: StudyIntent;
  topic: string | null;
}

export interface PendingAction {
  intent: Exclude<StudyIntent, 'chat'>;
  topic?: string;
  sourceMessage: string;
  createdAt: number;
}

const PENDING_ACTION_KEY = 'studyai_pending_action';

const COMMAND_SUGGESTIONS: Array<{ label: string; command: string; intent: StudyIntent }> = [
  { label: 'Explain topic', command: 'Explain machine learning', intent: 'explain_topic' },
  { label: 'Make Notes', command: 'Make notes for this topic', intent: 'generate_notes' },
  { label: 'Make Quiz', command: 'Create a quiz for this topic', intent: 'generate_quiz' },
  { label: 'Make Flashcards', command: 'Generate flashcards for this topic', intent: 'generate_flashcards' },
  { label: 'Start Learning Mode', command: 'Start learning mode', intent: 'learning_mode' },
  { label: 'Save Topic', command: 'Save this topic', intent: 'save_topic' },
];

function normalizeMessage(input: string): string {
  return input.trim().toLowerCase();
}

function extractTopic(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const explicitPatterns = [
    /(?:about|for|on)\s+(.+)$/i,
    /(?:explain|teach)\s+(.+)$/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim().replace(/[?.!,]+$/, '');
      if (candidate && !/^(this topic|current topic|it)$/i.test(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function detectIntent(message: string): IntentResult {
  const normalized = normalizeMessage(message);

  if (/\b(save|remember|bookmark)\b.*\b(topic|this)\b/.test(normalized)) {
    return { intent: 'save_topic', topic: extractTopic(message) };
  }

  if (/\b(start|open|go)\b.*\b(learning mode|learn mode)\b/.test(normalized)) {
    return { intent: 'learning_mode', topic: extractTopic(message) };
  }

  if (/\b(flashcards?|cards?)\b/.test(normalized) && /\b(make|create|generate|build|prepare)\b/.test(normalized)) {
    return { intent: 'generate_flashcards', topic: extractTopic(message) };
  }

  if (/\b(quiz|test|mcq)\b/.test(normalized) && /\b(make|create|generate|build|prepare)\b/.test(normalized)) {
    return { intent: 'generate_quiz', topic: extractTopic(message) };
  }

  if (/\b(notes?|summary)\b/.test(normalized) && /\b(make|create|generate|build|write|prepare)\b/.test(normalized)) {
    return { intent: 'generate_notes', topic: extractTopic(message) };
  }

  if (/\b(explain|teach|what is|help me understand|describe)\b/.test(normalized)) {
    return { intent: 'explain_topic', topic: extractTopic(message) };
  }

  return { intent: 'chat', topic: null };
}

export function routeForIntent(intent: Exclude<StudyIntent, 'chat'>): string {
  switch (intent) {
    case 'generate_notes':
      return '/notes';
    case 'generate_quiz':
      return '/quizzes';
    case 'generate_flashcards':
      return '/flashcards';
    case 'learning_mode':
      return '/learn';
    case 'save_topic':
    case 'explain_topic':
      return '/workspace';
    default:
      return '/tutor';
  }
}

export function getCommandSuggestions(input: string): Array<{ label: string; command: string; intent: StudyIntent }> {
  const normalized = normalizeMessage(input);
  if (!normalized) return COMMAND_SUGGESTIONS.slice(0, 4);

  return COMMAND_SUGGESTIONS
    .filter((item) => item.command.toLowerCase().includes(normalized) || item.label.toLowerCase().includes(normalized))
    .slice(0, 5);
}

export function setPendingAction(action: PendingAction): void {
  localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
}

export function getPendingAction(): PendingAction | null {
  const raw = localStorage.getItem(PENDING_ACTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAction;
  } catch {
    return null;
  }
}

export function clearPendingAction(): void {
  localStorage.removeItem(PENDING_ACTION_KEY);
}
