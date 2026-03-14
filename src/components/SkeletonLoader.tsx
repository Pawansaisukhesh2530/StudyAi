interface SkeletonProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{ width: i === lines - 1 ? '65%' : `${85 + Math.random() * 15}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-card card ${className}`}>
      <div className="skeleton-line skeleton-line--title" />
      <SkeletonText lines={4} />
    </div>
  );
}

export function SkeletonExplanation() {
  return (
    <div className="skeleton-explanation">
      {[4, 3, 2, 3].map((lines, i) => (
        <div key={i} className="skeleton-section card">
          <div className="skeleton-line skeleton-line--section-title" />
          <SkeletonText lines={lines} />
        </div>
      ))}
    </div>
  );
}
