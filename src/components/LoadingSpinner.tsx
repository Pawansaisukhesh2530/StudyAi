import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  text?: string;
}

export default function LoadingSpinner({ size = 24, text }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner">
      <Loader2 size={size} className="loading-spinner__icon" />
      {text && <span className="loading-spinner__text">{text}</span>}
    </div>
  );
}
