import { CheckCircle2, Circle, Lock } from 'lucide-react';

export interface PipelineStage {
  key: string;
  label: string;
  emoji: string;
  description: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'explanation', label: 'Explanation', emoji: '📘', description: 'AI generates a structured overview' },
  { key: 'concepts', label: 'Key Concepts', emoji: '🧠', description: 'Core ideas extracted from explanation' },
  { key: 'notes', label: 'Notes', emoji: '📝', description: 'Detailed study notes generated' },
  { key: 'flashcards', label: 'Flashcards', emoji: '🎴', description: 'Memorization cards created' },
  { key: 'quiz', label: 'Quiz', emoji: '🎯', description: 'Test your knowledge' },
  { key: 'revision', label: 'Revision', emoji: '🔁', description: 'Review and reinforce' },
];

interface LearningPipelineProps {
  completedSteps: string[];
  onStageClick?: (stage: PipelineStage) => void;
  hasExplanation?: boolean;
}

export default function LearningPipeline({ completedSteps, onStageClick, hasExplanation }: LearningPipelineProps) {
  function isStageUnlocked(_stage: PipelineStage, idx: number): boolean {
    if (idx === 0) return true;
    if (idx === 1) return hasExplanation ?? completedSteps.includes('explanation');
    return completedSteps.includes('explanation');
  }

  function isStageComplete(stage: PipelineStage): boolean {
    if (stage.key === 'concepts') return (hasExplanation ?? completedSteps.includes('explanation'));
    return completedSteps.includes(stage.key);
  }

  return (
    <div className="pipeline">
      <div className="pipeline__header">
        <span className="pipeline__title">Learning Journey</span>
        <span className="pipeline__progress">
          {completedSteps.length} / {PIPELINE_STAGES.length} steps
        </span>
      </div>
      <div className="pipeline__stages">
        {PIPELINE_STAGES.map((stage, idx) => {
          const unlocked = isStageUnlocked(stage, idx);
          const complete = isStageComplete(stage);
          return (
            <div key={stage.key} className="pipeline__stage-wrap">
              <button
                className={`pipeline__stage ${complete ? 'pipeline__stage--complete' : ''} ${unlocked && !complete ? 'pipeline__stage--active' : ''} ${!unlocked ? 'pipeline__stage--locked' : ''}`}
                onClick={() => unlocked && onStageClick?.(stage)}
                disabled={!unlocked}
                title={stage.description}
              >
                <span className="pipeline__stage-emoji">{stage.emoji}</span>
                <span className="pipeline__stage-label">{stage.label}</span>
                <span className="pipeline__stage-status">
                  {complete ? (
                    <CheckCircle2 size={14} className="pipeline__check" />
                  ) : unlocked ? (
                    <Circle size={14} className="pipeline__circle" />
                  ) : (
                    <Lock size={12} className="pipeline__lock" />
                  )}
                </span>
              </button>
              {idx < PIPELINE_STAGES.length - 1 && (
                <div className={`pipeline__connector ${complete ? 'pipeline__connector--done' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
