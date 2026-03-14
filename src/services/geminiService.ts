import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
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
}

export type ExplainMode = 'simpler' | 'eli5' | 'examples' | 'analogies';

export interface DiagramNode {
  id: string;
  label: string;
}

export interface DiagramData {
  type: 'flow' | 'concept';
  title: string;
  nodes: string[];
  edges: [string, string][];
  center?: string;
}

const MODEL_CANDIDATES = [
  (import.meta.env.VITE_GEMINI_MODEL as string) || 'gemini-2.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
];

function getApiKey(): string {
  const stored = localStorage.getItem('studyai_api_key');
  if (stored && stored.trim()) return stored.trim();

  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  if (envKey && envKey !== 'your_gemini_api_key_here') return envKey;

  throw new Error(
    'Gemini API key not set. Add your key in Settings or set VITE_GEMINI_API_KEY in .env.'
  );
}

function getUniqueModelCandidates(): string[] {
  return Array.from(new Set(MODEL_CANDIDATES.filter(Boolean)));
}

function isNotSupportedModelError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /404/i.test(message) || /not found/i.test(message) || /not supported/i.test(message);
}

function isModelUnavailableError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('not supported') ||
    message.includes('no compatible gemini model')
  );
}

function isRateLimitError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('quota exceeded') ||
    message.includes('service is currently busy')
  );
}

function getRetryDelayMs(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const retryInMatch = message.match(/retry in\s+([\d.]+)s/i);
  if (retryInMatch?.[1]) {
    return Math.max(500, Math.round(Number(retryInMatch[1]) * 1000));
  }
  const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (retryDelayMatch?.[1]) {
    return Math.max(500, Number(retryDelayMatch[1]) * 1000);
  }
  return 2000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTutorError(error: unknown): Error {
  if (isRateLimitError(error)) {
    return new Error('The AI service is currently busy. Please try again in a few seconds.');
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('api key')) {
    return new Error('Gemini API key is invalid or missing. Update it in Settings or .env.');
  }

  return new Error(`Failed to get AI response: ${message}`);
}

async function requestWithModelFallback<T>(fn: (modelName: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  let hadModelCompatibilityError = false;

  for (const modelName of getUniqueModelCandidates()) {
    try {
      return await fn(modelName);
    } catch (error) {
      lastError = error;
      if (!isNotSupportedModelError(error)) {
        throw normalizeTutorError(error);
      }
      hadModelCompatibilityError = true;
    }
  }

  if (hadModelCompatibilityError) {
    throw new Error('No compatible Gemini model is available for this API key/project right now.');
  }

  throw normalizeTutorError(lastError);
}

async function requestGeminiText(
  prompt: string,
  options?: { history?: TutorMessage[]; maxOutputTokens?: number }
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await requestWithModelFallback(async (modelName) => {
        const genAI = new GoogleGenerativeAI(getApiKey());
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: options?.maxOutputTokens ?? 2048,
          },
        });

        if (options?.history && options.history.length > 0) {
          const chat = model.startChat({
            history: options.history.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: options.maxOutputTokens ?? 2048 },
          });

          const result = await chat.sendMessage(prompt);
          return result.response.text();
        }

        const result = await model.generateContent(prompt);
        return result.response.text();
      });
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === 2) {
        throw error;
      }
      await sleep(getRetryDelayMs(error));
    }
  }

  throw normalizeTutorError(lastError);
}

function fallbackNotice(): string {
  return '> StudyAI fallback mode: Gemini is temporarily rate-limited, so this answer is generated locally.\n\n';
}

function fallbackTutorReply(prompt: string): string {
  const topic = prompt.trim() || 'this topic';
  return (
    fallbackNotice() +
    `## ${topic}\n\n` +
    `### Quick Explanation\n` +
    `- ${topic} can be learned by starting from basics and moving toward examples.\n\n` +
    `### Study Steps\n` +
    `1. Learn key definitions.\n` +
    `2. Understand one real example.\n` +
    `3. Practice with short questions.\n` +
    `4. Summarize in your own words.\n\n` +
    `### Next Prompt Suggestions\n` +
    `- Explain ${topic} like I'm a beginner.\n` +
    `- Give me a quiz on ${topic}.\n`
  );
}

function fallbackExplanation(topic: string): string {
  return (
    fallbackNotice() +
    `# ${topic}\n\n` +
    `## Topic Overview\n` +
    `- ${topic} is best learned through structured concepts, examples, and deliberate practice.\n` +
    `- Strong understanding comes from connecting theory with real scenarios.\n\n` +
    `## Key Concepts\n` +
    `- Start with foundational terminology and core rules.\n` +
    `- Separate basics from advanced ideas to reduce confusion.\n` +
    `- Link every concept to at least one practical application.\n` +
    `- Use self-testing to verify understanding.\n\n` +
    `## How It Works Step-by-Step\n` +
    `1. Define the main goal of ${topic}.\n` +
    `2. Split the topic into manageable sub-concepts.\n` +
    `3. Learn each concept with examples and edge cases.\n` +
    `4. Practice retrieval through questions and short summaries.\n\n` +
    `## Common Misconceptions\n` +
    `- Memorizing terms alone is enough: incorrect; you must apply concepts.\n` +
    `- One long study session is better: incorrect; spaced sessions work better.\n` +
    `- Difficulty means inability: incorrect; it often means the right learning zone.\n\n` +
    `## Real-World Example\n` +
    `- Apply ${topic} to a practical case, break it into components, and validate each decision step.\n\n` +
    `## Exam and Interview Style Questions\n` +
    `- What is the core objective of ${topic}?\n` +
    `- How would you apply it in a practical scenario?\n` +
    `- What are common mistakes and how do you avoid them?\n\n` +
    `## Key Takeaways\n` +
    `- Learn basics deeply, then apply with examples, then test and revise.\n`
  );
}

function fallbackNotes(topic: string): string {
  return (
    fallbackNotice() +
    `# Study Notes: ${topic}\n\n` +
    `## Key Definitions\n` +
    `- **${topic}**: A topic explored through concepts, examples, and practice.\n\n` +
    `## Core Concepts\n` +
    `- Build understanding from fundamentals.\n` +
    `- Use simple examples to reinforce each concept.\n` +
    `- Review and self-test regularly.\n\n` +
    `## Summary\n` +
    `- Consistent short practice sessions lead to strong understanding.\n`
  );
}

function fallbackFlashcards(topic: string, count: number): Flashcard[] {
  return Array.from({ length: Math.min(count, 6) }, (_, i) => ({
    id: `${Date.now()}-fallback-${i + 1}`,
    question: `What is a key concept of ${topic}? (${i + 1})`,
    answer: `${topic} involves understanding core principles and applying them to real-world situations. Review the explanation for details.`,
  }));
}

function normalizeGeneratedFlashcards(payload: unknown): Flashcard[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((raw, idx) => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as {
        id?: string;
        question?: string;
        answer?: string;
        front?: string;
        back?: string;
      };

      const question = (item.question ?? item.front ?? '').trim();
      const answer = (item.answer ?? item.back ?? '').trim();
      if (!question || !answer) return null;

      return {
        id: item.id?.trim() || `${Date.now()}-flashcard-${idx}`,
        question,
        answer,
      };
    })
    .filter((item): item is Flashcard => Boolean(item));
}

function fallbackDiagram(topic: string): DiagramData {
  return {
    type: 'flow',
    title: `${topic} Overview`,
    nodes: ['Introduction', 'Core Concepts', 'Applications', 'Summary'],
    edges: [['Introduction', 'Core Concepts'], ['Core Concepts', 'Applications'], ['Applications', 'Summary']],
  };
}

function fallbackQuiz(topic: string, count: number): QuizQuestion[] {
  const total = Math.max(1, Math.min(10, count));
  return Array.from({ length: total }, (_, idx) => ({
    question: `(${idx + 1}) What is the most effective way to learn ${topic}?`,
    options: [
      'Skip basics and memorize answers only',
      'Learn concepts, then apply them with examples',
      'Avoid practice and tests',
      'Read once and never review',
    ],
    correctIndex: 1,
    explanation: `For ${topic}, understanding concepts and practicing examples works best.`,
  }));
}

export async function requestTutorReply(
  prompt: string,
  history: TutorMessage[]
): Promise<string> {
  const systemInstruction =
    'You are StudyAI, a helpful tutor. Explain clearly for students using concise headings, bullet points, and examples.';
  try {
    return await requestGeminiText(`${systemInstruction}\n\nUser question: ${prompt}`, {
      history,
      maxOutputTokens: 2048,
    });
  } catch (error) {
    if (isRateLimitError(error) || isModelUnavailableError(error)) {
      return fallbackTutorReply(prompt);
    }
    throw error;
  }
}

export async function generateExplanation(topic: string): Promise<string> {
  const prompt = `You are an expert tutor. Generate a deep, high-detail learning guide for the topic: "${topic}".

Important quality requirements:
- Write a detailed response between 900 and 1400 words.
- Be precise, conceptually accurate, and student-friendly.
- Use concrete examples and practical applications.
- Avoid vague summaries.

Format your response EXACTLY using these section headers:

## Topic Overview
[Write a rich introduction with background, why the topic matters, and where it is used. 2-3 substantial paragraphs.]

## Key Concepts
- **[Concept Name]**: [Clear definition]
- **[Concept Name]**: [Clear definition]
- **[Concept Name]**: [Clear definition]
(List 8-12 key concepts with meaningful depth, not one-line bullets)

## How It Works Step-by-Step
[Break the topic into a logical sequence. Use numbered steps and explain each one clearly.]

## Common Misconceptions
- [Misconception]
- [Why it is wrong]
- [Correct understanding]

Include at least 3 misconceptions.

## Real-World Example
[Explain 2-3 concrete, relatable real-world examples that illustrate the topic clearly.]

## Exam and Interview Style Questions
- [Question]
- [Short model answer]

Include at least 5 questions with high-quality model answers.

## Key Takeaways
- [Most important point 1]
- [Most important point 2]
- [Most important point 3]
- [Most important point 4]

Include at least 8 key takeaways.

Be thorough, structured, and educational.`;

  try {
    return await requestGeminiText(prompt, { maxOutputTokens: 4096 });
  } catch (error) {
    if (isRateLimitError(error) || isModelUnavailableError(error)) {
      return fallbackExplanation(topic);
    }
    throw error;
  }
}

export async function generateNotes(topic: string): Promise<string> {
  const prompt = `Create comprehensive study notes for the topic: "${topic}".

Format with:
# Main Title

## Key Definitions
- **Term**: Definition

## Core Concepts
- Bullet point explanations

## Important Details
- Details and sub-points

## Summary
A concise summary paragraph.

Make notes thorough, well-organized, and student-friendly.`;

  try {
    return await requestGeminiText(prompt, { maxOutputTokens: 3072 });
  } catch (error) {
    if (isRateLimitError(error) || isModelUnavailableError(error)) {
      return fallbackNotes(topic);
    }
    throw error;
  }
}

export async function generateQuiz(topic: string, count: number = 5): Promise<QuizQuestion[]> {
  const prompt = `Generate exactly ${count} multiple choice quiz questions about: "${topic}".

Return ONLY valid JSON array (no markdown, no explanation outside JSON), like:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Explanation why the answer is correct."
  }
]

Make sure questions are educational, clear, and appropriately challenging for students.`;

  let text = '';
  try {
    text = await requestGeminiText(prompt, { maxOutputTokens: 2048 });
  } catch (error) {
    if (isRateLimitError(error) || isModelUnavailableError(error)) {
      return fallbackQuiz(topic, count);
    }
    throw error;
  }
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(cleaned) as QuizQuestion[];
  } catch {
    throw new Error('Failed to parse quiz response from AI. Please try again.');
  }
}

export async function generateFlashcards(topic: string, count: number = 8): Promise<Flashcard[]> {
  const prompt = `Generate exactly ${count} flashcards for studying the topic: "${topic}".

Return ONLY valid JSON array (no markdown, no extra text), like:
[
  { "question": "Question?", "answer": "Answer." }
]

Make them educational, clear, and progressively covering the key concepts of ${topic}.`;

  let text = '';
  try {
    text = await requestGeminiText(prompt, { maxOutputTokens: 2048 });
  } catch (error) {
    if (isRateLimitError(error) || isModelUnavailableError(error)) {
      return fallbackFlashcards(topic, count);
    }
    throw error;
  }
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const normalized = normalizeGeneratedFlashcards(parsed);
    if (normalized.length === 0) {
      throw new Error('No valid flashcards in AI response.');
    }
    return normalized;
  } catch {
    throw new Error('Failed to parse flashcards from AI. Please try again.');
  }
}

export async function generateDiagram(topic: string): Promise<DiagramData> {
  const prompt = `Generate a concept diagram for: "${topic}".

Return ONLY valid JSON (no markdown), in this format:
{
  "type": "flow",
  "title": "${topic} Architecture",
  "nodes": ["Node1", "Node2", "Node3", "Node4"],
  "edges": [["Node1", "Node2"], ["Node2", "Node3"], ["Node3", "Node4"]]
}

Rules:
- Use "flow" type for linear processes (A?B?C?D)
- Use "concept" type for hub-and-spoke maps (center connected to all nodes), and add a "center" field
- Keep node labels short (1-3 words)
- Use 4-7 nodes maximum
- Make edges meaningful and directional`;

  let text = '';
  try {
    text = await requestGeminiText(prompt, { maxOutputTokens: 1024 });
  } catch (error) {
    if (isRateLimitError(error) || isModelUnavailableError(error)) {
      return fallbackDiagram(topic);
    }
    throw error;
  }
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned) as DiagramData;
  } catch {
    return fallbackDiagram(topic);
  }
}

export async function reexplain(topic: string, currentExplanation: string, mode: ExplainMode): Promise<string> {
  const modeInstructions: Record<ExplainMode, string> = {
    simpler: 'Explain this more simply. Use shorter sentences and simpler vocabulary.',
    eli5: 'Explain this like I am 5 years old. Use very simple language and fun analogies a child would understand.',
    examples: 'Explain this using lots of real-world examples. Give 3-4 concrete, relatable examples.',
    analogies: 'Explain this using creative analogies and comparisons. Compare it to everyday things people know well.',
  };

  const prompt = `Topic: "${topic}"

Current explanation:
${currentExplanation.slice(0, 1000)}

${modeInstructions[mode]}

Format the response with the same ## section headers (Topic Overview, Key Concepts, Real-World Example, Key Takeaways) but adapted to the style requested.`;

  try {
    return await requestGeminiText(prompt, { maxOutputTokens: 3072 });
  } catch (error) {
    if (isRateLimitError(error) || isModelUnavailableError(error)) {
      return fallbackExplanation(topic);
    }
    throw error;
  }
}

export async function generateFollowUpAnswer(topic: string, question: string): Promise<string> {
  const prompt = `You are a helpful tutor. The student is studying: "${topic}".

They ask: "${question}"

Answer their question clearly and concisely, specifically in the context of ${topic}. Use bullet points or short paragraphs. Be educational and student-friendly.`;

  try {
    return await requestGeminiText(prompt, { maxOutputTokens: 1024 });
  } catch (error) {
    if (isRateLimitError(error) || isModelUnavailableError(error)) {
      return `> Currently in fallback mode.\n\nGreat question about **${topic}**! \n\n- This relates to the core concepts we explored.\n- Try revisiting the Key Concepts section for more context.\n- The real-world example may also help clarify this.`;
    }
    throw error;
  }
}
