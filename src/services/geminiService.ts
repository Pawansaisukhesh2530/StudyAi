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
        const model = genAI.getGenerativeModel({ model: modelName });

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
    `## Definition\n` +
    `- ${topic} is a topic best learned through clear concepts and examples.\n\n` +
    `## Key Concepts\n` +
    `- Start with terminology and core rules.\n` +
    `- Connect each concept to a practical example.\n` +
    `- Review with active recall.\n\n` +
    `## Why It Matters\n` +
    `- Understanding ${topic} improves analytical thinking and problem solving.\n\n` +
    `## Summary\n` +
    `- Learn basics, practice examples, test yourself, and revise.\n`
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
  const prompt = `You are an expert tutor. Generate a comprehensive explanation for the topic: "${topic}".
Include:
- A clear definition
- Key concepts and ideas
- How it works (with examples)
- Why it matters
- A short summary

Format with headings, bullet points, and examples. Be thorough but student-friendly.`;

  try {
    return await requestGeminiText(prompt);
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
    return await requestGeminiText(prompt);
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
    text = await requestGeminiText(prompt);
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
