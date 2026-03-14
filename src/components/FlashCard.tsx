import { useState } from 'react';
import type { Flashcard } from '../services/geminiService';

interface FlashCardProps {
  card: Flashcard;
  index: number;
  total: number;
}

export default function FlashCard({ card, index, total }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flashcard-scene" onClick={() => setFlipped((f) => !f)}>
      <div className={`flashcard-card ${flipped ? 'flashcard-card--flipped' : ''}`}>
        {/* Front */}
        <div className="flashcard-face flashcard-face--front">
          <div className="flashcard-badge">{index + 1} / {total}</div>
          <div className="flashcard-label">Question</div>
          <p className="flashcard-text">{card.front}</p>
          <div className="flashcard-hint">Click to reveal answer</div>
        </div>
        {/* Back */}
        <div className="flashcard-face flashcard-face--back">
          <div className="flashcard-badge">{index + 1} / {total}</div>
          <div className="flashcard-label flashcard-label--answer">Answer</div>
          <p className="flashcard-text">{card.back}</p>
          <div className="flashcard-hint">Click to flip back</div>
        </div>
      </div>
    </div>
  );
}
