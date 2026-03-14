import { getStats, getQuizzes, getTopics, getNotes, getConversations, getTopicsMastered } from '../services/storage';
import { BarChart2, BookOpen, HelpCircle, FileText, MessageSquare, TrendingUp, Flame, Trophy, Brain, Star } from 'lucide-react';

export default function ProgressPage() {
  const stats = getStats();
  const quizzes = getQuizzes();
  const completedQuizzes = quizzes.filter((q) => q.score !== null);
  const avgScore =
    completedQuizzes.length > 0
      ? Math.round(completedQuizzes.reduce((s, q) => s + (q.score ?? 0), 0) / completedQuizzes.length)
      : null;

  const topics = getTopics();
  const notes = getNotes();
  const conversations = getConversations();
  const topicsMastered = getTopicsMastered();
  const topicsInProgress = Math.max(0, topics.length - topicsMastered);

  const heroStats = [
    {
      label: 'Study Streak',
      value: `${stats.studyStreak} day${stats.studyStreak !== 1 ? 's' : ''}`,
      icon: Flame,
      color: '#f97316',
      bg: '#f9731620',
      emoji: '🔥',
      detail: stats.studyStreak > 0 ? 'Keep it going!' : 'Start learning today!',
    },
    {
      label: 'Topics Mastered',
      value: topicsMastered,
      icon: Trophy,
      color: '#f59e0b',
      bg: '#f59e0b20',
      emoji: '🏆',
      detail: `${topicsInProgress} in progress`,
    },
    {
      label: 'Concepts Learned',
      value: stats.conceptsLearned,
      icon: Brain,
      color: '#a855f7',
      bg: '#a855f720',
      emoji: '🧠',
      detail: 'From explanations generated',
    },
    {
      label: 'Quiz Accuracy',
      value: avgScore !== null ? `${avgScore}%` : '—',
      icon: Star,
      color: '#6366f1',
      bg: '#6366f120',
      emoji: '🎯',
      detail: `${completedQuizzes.length} quiz${completedQuizzes.length !== 1 ? 'zes' : ''} completed`,
    },
  ];

  const statCards = [
    { label: 'Topics Studied', value: topics.length, icon: BookOpen, color: '#6366f1', bg: '#6366f120' },
    { label: 'Notes Created', value: notes.length, icon: FileText, color: '#ec4899', bg: '#ec489920' },
    { label: 'AI Interactions', value: stats.aiInteractions, icon: MessageSquare, color: '#10b981', bg: '#10b98120' },
    { label: 'Conversations', value: conversations.length, icon: BarChart2, color: '#06b6d4', bg: '#06b6d420' },
    { label: 'Quizzes Done', value: completedQuizzes.length, icon: HelpCircle, color: '#a855f7', bg: '#a855f720' },
    { label: 'Avg. Score', value: avgScore !== null ? `${avgScore}%` : 'N/A', icon: TrendingUp, color: '#f59e0b', bg: '#f59e0b20' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">📊 Learning Progress</h1>
        <p className="page-subtitle">Track your study activity and performance over time.</p>
      </div>

      {/* Hero stats */}
      <div className="progress-hero-grid">
        {heroStats.map(({ label, value, color, emoji, detail }) => (
          <div key={label} className="progress-hero-card card">
            <div className="progress-hero-card__emoji">{emoji}</div>
            <div className="progress-hero-card__value" style={{ color }}>{value}</div>
            <div className="progress-hero-card__label">{label}</div>
            <div className="progress-hero-card__detail">{detail}</div>
          </div>
        ))}
      </div>

      {/* Regular stats grid */}
      <div className="progress-stats-grid">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div className="stat-card card" key={label}>
            <div className="stat-card__icon-wrap" style={{ background: bg }}>
              <Icon size={24} color={color} />
            </div>
            <div className="stat-card__info">
              <span className="stat-card__value">{value}</span>
              <span className="stat-card__label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quiz Performance section */}
      {completedQuizzes.length > 0 && (
        <div className="card progress-section">
          <h2 className="card__title">🎯 Recent Quiz Performance</h2>
          <div className="quiz-performance-list">
            {completedQuizzes.slice(0, 8).map((q) => (
              <div key={q.id} className="quiz-perf-item">
                <span className="quiz-perf-item__topic">{q.topic}</span>
                <div className="quiz-perf-item__bar-wrap">
                  <div
                    className="quiz-perf-item__bar"
                    style={{
                      width: `${q.score}%`,
                      background: (q.score ?? 0) >= 70 ? '#10b981' : '#ef4444',
                    }}
                  />
                </div>
                <span
                  className="quiz-perf-item__score"
                  style={{ color: (q.score ?? 0) >= 70 ? '#10b981' : '#ef4444' }}
                >
                  {q.score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent topics */}
      {topics.length > 0 && (
        <div className="card progress-section">
          <h2 className="card__title">📚 Recently Studied Topics</h2>
          <div className="recent-topics">
            {topics.slice(0, 10).map((t) => (
              <div key={t.id} className={`recent-topic-chip ${(t.completedSteps ?? []).includes('quiz') ? 'recent-topic-chip--mastered' : ''}`}>
                <BookOpen size={12} />
                {t.name}
                {(t.completedSteps ?? []).includes('quiz') && <span style={{ color: '#f59e0b' }}>★</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {topics.length === 0 && completedQuizzes.length === 0 && (
        <div className="card empty-state-card">
          <div className="empty-state">
            <BarChart2 size={48} className="empty-state__icon" />
            <h3>No activity yet</h3>
            <p>Start learning by chatting with the AI Tutor or generating study materials in the Workspace.</p>
          </div>
        </div>
      )}
    </div>
  );
}

