import { useState } from 'react';
import { FileText, Loader2, Edit3, Check, X } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { generateNotes } from '../services/geminiService';
import {
  getTopics,
  getActiveTopicId,
  setActiveTopic,
  updateTopic,
  saveNote,
  incrementAiInteraction,
  type Topic,
} from '../services/storage';

export default function NotesPage() {
  const [topics, setTopics] = useState<Topic[]>(() => getTopics());
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(() => {
    const active = getActiveTopicId();
    return active ?? (getTopics()[0]?.id ?? null);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;
  const activeNotes = selectedTopic?.notes ?? null;

  async function handleGenerate() {
    if (!selectedTopic) return;
    setLoading(true);
    setError(null);
    try {
      const content = await generateNotes(selectedTopic.name);
      incrementAiInteraction();
      updateTopic(selectedTopic.id, { notes: content });
      saveNote({ topic: selectedTopic.name, content });
      setTopics(getTopics());
      setEditing(false);
      setEditContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notes.');
    } finally {
      setLoading(false);
    }
  }

  function handleEditStart() {
    if (!activeNotes) return;
    setEditContent(activeNotes);
    setEditing(true);
  }

  function handleEditSave() {
    if (!selectedTopicId) return;
    updateTopic(selectedTopicId, { notes: editContent });
    setTopics(getTopics());
    setEditing(false);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Notes</h1>
        <p className="page-subtitle">Generate and manage notes from your selected topic.</p>
      </div>

      <div className="card">
        <div className="input-row">
          <select
            className="select-input"
            value={selectedTopicId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedTopicId(id);
              setActiveTopic(id);
              setEditing(false);
            }}
          >
            {topics.length === 0 && <option value="">No topics available</option>}
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </select>
          <button
            className="btn btn--primary"
            onClick={handleGenerate}
            disabled={loading || !selectedTopic}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
            <span>{loading ? 'Generating...' : 'Generate Notes'}</span>
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {selectedTopic && (
        <div className="card note-view">
            <div className="card__header">
              <h2 className="card__title">{selectedTopic.name}</h2>
              <div className="card__actions">
                {editing ? (
                  <>
                    <button className="btn btn--success btn--sm" onClick={handleEditSave}>
                      <Check size={14} /> Save
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
                      <X size={14} /> Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn btn--secondary btn--sm" onClick={handleEditStart} disabled={!activeNotes}>
                    <Edit3 size={14} /> Edit
                  </button>
                )}
              </div>
            </div>
            <div className="card__body">
              {editing ? (
                <textarea
                  className="note-editor"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              ) : activeNotes ? (
                <MarkdownRenderer content={activeNotes} />
              ) : (
                <p className="page-subtitle">No notes generated for this topic yet.</p>
              )}
            </div>
        </div>
      )}

      {!selectedTopic && (
        <div className="card notes-empty-state">
          <div className="empty-state">
            <FileText size={48} className="empty-state__icon" />
            <p>Create a topic in Workspace first, then generate notes from that topic.</p>
          </div>
        </div>
      )}
    </div>
  );
}
