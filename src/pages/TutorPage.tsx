import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Trash2, MessageSquare, Sparkles, FileText, HelpCircle, CreditCard, Rocket, BookOpen, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { SkeletonText } from '../components/SkeletonLoader';
import {
  getConversations,
  saveConversation,
  createConversation,
  deleteConversation,
  type Conversation,
  type ChatMessage,
} from '../services/storage';
import { requestTutorReply, type TutorMessage } from '../services/geminiService';
import { incrementAiInteraction } from '../services/storage';
import {
  detectIntent,
  getCommandSuggestions,
  routeForIntent,
  setPendingAction,
  type IntentResult,
} from '../services/intentSystem';
import { useTopicContext } from '../context/TopicContext';

const REQUEST_COOLDOWN_MS = 2000;

export default function TutorPage() {
  const navigate = useNavigate();
  const { topics, currentTopic } = useTopicContext();
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const convs = getConversations();
    return convs.length > 0 ? convs[0].id : null;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const lastRequestAtRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recentTopics = topics.slice(0, 5);
  const commandSuggestions = getCommandSuggestions(input);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const groupedConversations = (() => {
    const groups: Record<'today' | 'yesterday' | 'lastWeek', Conversation[]> = {
      today: [],
      yesterday: [],
      lastWeek: [],
    };
    const nowDate = new Date();
    const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

    conversations.forEach((conv) => {
      if (conv.updatedAt >= todayStart) groups.today.push(conv);
      else if (conv.updatedAt >= yesterdayStart) groups.yesterday.push(conv);
      else if (conv.updatedAt >= weekStart) groups.lastWeek.push(conv);
    });

    return groups;
  })();

  function handleNewConversation() {
    const conv = createConversation();
    saveConversation(conv);
    setConversations(getConversations());
    setActiveId(conv.id);
  }

  function handleDeleteConversation(id: string) {
    deleteConversation(id);
    const updated = getConversations();
    setConversations(updated);
    if (activeId === id) {
      setActiveId(updated.length > 0 ? updated[0].id : null);
    }
  }

  function handleRenameConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const nextTitle = window.prompt('Rename conversation', conv.title);
    if (!nextTitle || !nextTitle.trim()) return;
    saveConversation({ ...conv, title: nextTitle.trim(), updatedAt: Date.now() });
    setConversations(getConversations());
  }

  function createAssistantMessage(content: string): ChatMessage {
    return {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
    };
  }

  function resolveTopic(intentResult: IntentResult): string | null {
    if (intentResult.topic) return intentResult.topic;
    return currentTopic?.name ?? null;
  }

  function handleIntentCommand(intentResult: IntentResult, updatedConv: Conversation): boolean {
    if (intentResult.intent === 'chat') return false;

    const topic = resolveTopic(intentResult);
    const topicRequired = intentResult.intent !== 'learning_mode';

    if (topicRequired && !topic) {
      const failMsg = createAssistantMessage(
        'Please create or select a topic first.'
      );
      saveConversation({
        ...updatedConv,
        messages: [...updatedConv.messages, failMsg],
        updatedAt: Date.now(),
      });
      setConversations(getConversations());
      return true;
    }

    setPendingAction({
      intent: intentResult.intent,
      topic: topic ?? undefined,
      sourceMessage: updatedConv.messages[updatedConv.messages.length - 1]?.content ?? '',
      createdAt: Date.now(),
    });

    const route = routeForIntent(intentResult.intent);
    const labelByIntent: Record<typeof intentResult.intent, string> = {
      generate_notes: 'Generating notes',
      generate_quiz: 'Generating quiz',
      generate_flashcards: 'Generating flashcards',
      add_flashcard: 'Adding flashcards',
      delete_flashcard: 'Deleting flashcard',
      edit_flashcard: 'Editing flashcard',
      explain_topic: 'Opening explanation flow',
      learning_mode: 'Starting learning mode',
      save_topic: 'Saving topic',
    };

    const successMsg = createAssistantMessage(`✅ ${labelByIntent[intentResult.intent]}${topic ? ` for **${topic}**` : ''}.`);
    saveConversation({
      ...updatedConv,
      messages: [...updatedConv.messages, successMsg],
      updatedAt: Date.now(),
    });
    setConversations(getConversations());
    navigate(route);
    return true;
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const now = Date.now();
    if (now - lastRequestAtRef.current < REQUEST_COOLDOWN_MS) {
      setError('Please wait a moment before sending another request.');
      return;
    }

    setError(null);
    lastRequestAtRef.current = now;

    let conv = activeConversation;
    if (!conv) {
      conv = createConversation();
    }

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    // Auto-title by first message
    if (conv.messages.length === 0) {
      conv = { ...conv, title: trimmed.slice(0, 50) };
    }

    const updatedConv: Conversation = {
      ...conv,
      messages: [...conv.messages, userMsg],
      updatedAt: Date.now(),
    };

    saveConversation(updatedConv);
    setConversations(getConversations());
    setActiveId(updatedConv.id);
    setInput('');
    setShowSuggestions(false);
    setLoading(true);

    try {
      const intentResult = detectIntent(trimmed);
      if (handleIntentCommand(intentResult, updatedConv)) {
        setLoading(false);
        return;
      }

      const history: TutorMessage[] = updatedConv.messages
        .slice(0, -1)
        .map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));

      const responseText = await requestTutorReply(trimmed, history);
      incrementAiInteraction();

      const aiMsg: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
      };

      const finalConv: Conversation = {
        ...updatedConv,
        messages: [...updatedConv.messages, aiMsg],
        updatedAt: Date.now(),
      };
      saveConversation(finalConv);
      setConversations(getConversations());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get AI response.';
      if (message.toLowerCase().includes('429') || message.toLowerCase().includes('busy')) {
        setError('The AI service is currently busy. Please try again in a few seconds.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="tutor-page">
      {/* Conversation history sidebar */}
      <aside className="tutor-page__history">
        <div className="tutor-page__history-header">
          <span className="tutor-page__history-title">Conversations</span>
          <button className="icon-btn" onClick={handleNewConversation} title="New conversation">
            <Plus size={18} />
          </button>
        </div>
        <div className="tutor-page__history-list">
          {conversations.length === 0 && (
            <p className="tutor-page__history-empty">No conversations yet</p>
          )}
          {[
            { label: 'Today', items: groupedConversations.today },
            { label: 'Yesterday', items: groupedConversations.yesterday },
            { label: 'Last Week', items: groupedConversations.lastWeek },
          ].map((group) => (
            group.items.length > 0 ? (
              <div key={group.label} className="tutor-page__history-group">
                <div className="tutor-page__history-group-label">{group.label}</div>
                {group.items.map((conv) => (
                  <div
                    key={conv.id}
                    className={`tutor-page__history-item ${conv.id === activeId ? 'tutor-page__history-item--active' : ''}`}
                    onClick={() => setActiveId(conv.id)}
                  >
                    <MessageSquare size={14} />
                    <span className="tutor-page__history-item-title">{conv.title}</span>
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameConversation(conv.id);
                      }}
                      title="Rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn icon-btn--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null
          ))}
        </div>
      </aside>

      {/* Chat panel */}
      <div className="tutor-page__chat">
        <div className="tutor-page__messages">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="tutor-page__welcome">
              <div className="tutor-page__welcome-icon">🎓</div>
              <h2>Welcome to AI Tutor</h2>
              <p>Ask anything below or jump directly into a learning workflow.</p>

              <div className="tutor-feature-cards">
                <button className="tutor-feature-card" onClick={() => navigate('/workspace')}>
                  <FileText size={16} />
                  <div>
                    <strong>Generate Notes</strong>
                    <span>Turn topics into study notes.</span>
                  </div>
                </button>
                <button className="tutor-feature-card" onClick={() => navigate('/quizzes')}>
                  <HelpCircle size={16} />
                  <div>
                    <strong>Generate Quiz</strong>
                    <span>Practice with AI questions.</span>
                  </div>
                </button>
                <button className="tutor-feature-card" onClick={() => navigate('/flashcards')}>
                  <CreditCard size={16} />
                  <div>
                    <strong>Flashcards</strong>
                    <span>Memorize concepts quickly.</span>
                  </div>
                </button>
                <button className="tutor-feature-card" onClick={() => navigate('/learn')}>
                  <Rocket size={16} />
                  <div>
                    <strong>Learning Mode</strong>
                    <span>Follow guided study steps.</span>
                  </div>
                </button>
              </div>

              <div className="tutor-recent-topics card">
                <div className="tutor-recent-topics__title">
                  <BookOpen size={14} /> Recent Topics
                </div>
                <div className="workspace-suggestions">
                  {recentTopics.length === 0 && <span className="page-subtitle">No recent topics yet.</span>}
                  {recentTopics.map((topic) => (
                    <button key={topic.id} className="chip" onClick={() => navigate('/workspace')}>
                      {topic.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tutor-page__suggestions">
                {[
                  'Explain photosynthesis to me',
                  'How does machine learning work?',
                  'What is the French Revolution?',
                  'Explain the Pythagorean theorem',
                ].map((s) => (
                  <button
                    key={s}
                    className="tutor-page__suggestion-chip"
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeConversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble chat-bubble--${msg.role}`}
              >
                <div className="chat-bubble__avatar">
                  {msg.role === 'user' ? '👤' : '🎓'}
                </div>
                <div className="chat-bubble__content">
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="chat-bubble chat-bubble--assistant">
              <div className="chat-bubble__avatar">🎓</div>
              <div className="chat-bubble__content">
                <div className="chat-loading-state">
                  <SkeletonText lines={3} />
                  <div className="chat-loading-label"><Sparkles size={14} /> Thinking...</div>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="error-banner">
              <strong>Error:</strong> {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="tutor-page__input-area">
          <textarea
            className="tutor-page__input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Ask the AI tutor anything... (Enter to send, Shift+Enter for a new line)"
            rows={3}
            disabled={loading}
          />
          {showSuggestions && commandSuggestions.length > 0 && (
            <div className="tutor-command-suggestions">
              {commandSuggestions.map((suggestion) => (
                <button
                  key={suggestion.command}
                  className="tutor-command-suggestion"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInput(suggestion.command);
                    setShowSuggestions(false);
                  }}
                >
                  <span>{suggestion.label}</span>
                  <small>{suggestion.command}</small>
                </button>
              ))}
            </div>
          )}
          <button
            className="btn btn--primary tutor-page__send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <Send size={18} />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
