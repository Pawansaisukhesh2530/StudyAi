import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  getConversations,
  saveConversation,
  createConversation,
  deleteConversation,
  type Conversation,
  type ChatMessage,
} from '../services/storage';
import { requestTutorReply, type TutorMessage } from '../services/geminiService';
import { generateExplanation } from '../services/geminiService';
import { incrementAiInteraction, upsertTopicFromExplanation, setActiveTopic } from '../services/storage';

const REQUEST_COOLDOWN_MS = 2000;

export default function TutorPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>(() => getConversations());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const convs = getConversations();
    return convs.length > 0 ? convs[0].id : null;
  });
  const [input, setInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [topicLoading, setTopicLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequestAtRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

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
    setLoading(true);

    try {
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

  async function handleStartTopicLearning() {
    const trimmed = topicInput.trim();
    if (!trimmed || topicLoading) return;
    setError(null);
    setTopicLoading(true);
    try {
      const explanation = await generateExplanation(trimmed);
      incrementAiInteraction();
      const topic = upsertTopicFromExplanation(trimmed, explanation);
      setActiveTopic(topic.id);
      navigate('/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start topic learning.');
    } finally {
      setTopicLoading(false);
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
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`tutor-page__history-item ${conv.id === activeId ? 'tutor-page__history-item--active' : ''}`}
              onClick={() => setActiveId(conv.id)}
            >
              <MessageSquare size={14} />
              <span className="tutor-page__history-item-title">{conv.title}</span>
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
      </aside>

      {/* Chat panel */}
      <div className="tutor-page__chat">
        <div className="tutor-page__messages">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="tutor-page__welcome">
              <div className="tutor-page__welcome-icon">🎓</div>
              <h2>Welcome to AI Tutor</h2>
              <p>Ask me anything — I'll explain it clearly and thoroughly.</p>
              <div className="input-row" style={{ width: '100%', maxWidth: 640 }}>
                <input
                  className="text-input"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartTopicLearning()}
                  placeholder="Start learning a topic once (e.g., Cell Biology)"
                  disabled={topicLoading || loading}
                />
                <button
                  className="btn btn--secondary"
                  onClick={handleStartTopicLearning}
                  disabled={topicLoading || !topicInput.trim()}
                >
                  {topicLoading ? 'Preparing...' : 'Start Topic Learning'}
                </button>
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
                <LoadingSpinner size={20} text="Thinking..." />
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI tutor anything... (Enter to send, Shift+Enter for new line)"
            rows={3}
            disabled={loading}
          />
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
