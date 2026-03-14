import { useState } from 'react';
import { BookOpen, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { getTopics, deleteTopic, setActiveTopic, getActiveTopicId, type Topic } from '../services/storage';

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>(() => getTopics());
  const [expandedId, setExpandedId] = useState<string | null>(() => getActiveTopicId());

  function handleDelete(id: string) {
    deleteTopic(id);
    setTopics(getTopics());
    if (expandedId === id) setExpandedId(null);
  }

  function handleSelectTopic(id: string) {
    setExpandedId(expandedId === id ? null : id);
    setActiveTopic(id);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">My Topics</h1>
        <p className="page-subtitle">All topics you have studied are saved here for future reference.</p>
      </div>

      {topics.length === 0 ? (
        <div className="card empty-state-card">
          <div className="empty-state">
            <BookOpen size={48} className="empty-state__icon" />
            <h3>No topics studied yet</h3>
            <p>Go to the <a href="/workspace">Workspace</a> and generate explanations to save topics here.</p>
          </div>
        </div>
      ) : (
        <div className="topics-list">
          {topics.map((topic) => (
            <div key={topic.id} className="topic-card card">
              <div className="topic-card__header" onClick={() => handleSelectTopic(topic.id)}>
                <div className="topic-card__info">
                  <BookOpen size={18} className="topic-card__icon" />
                  <div>
                    <h3 className="topic-card__title">{topic.name}</h3>
                    <span className="topic-card__date">
                      {new Date(topic.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="topic-card__actions">
                  <button
                    className="icon-btn icon-btn--danger"
                    onClick={(e) => { e.stopPropagation(); handleDelete(topic.id); }}
                    title="Delete topic"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button className="icon-btn" title="Expand">
                    {expandedId === topic.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>
              {expandedId === topic.id && (
                <div className="topic-card__body">
                  <h4>Explanation</h4>
                  <MarkdownRenderer content={topic.explanation || 'No explanation generated yet.'} />

                  <div style={{ marginTop: '1rem' }}>
                    <h4>Notes</h4>
                    <MarkdownRenderer content={topic.notes || 'No notes generated yet.'} />
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <h4>Quiz Resources</h4>
                    {topic.quizzes.length === 0 ? (
                      <p className="page-subtitle">No quiz generated yet.</p>
                    ) : (
                      <ol style={{ paddingLeft: '1.2rem' }}>
                        {topic.quizzes.map((q, idx) => (
                          <li key={`${topic.id}-q-${idx}`} style={{ marginBottom: '.5rem' }}>
                            {q.question}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
