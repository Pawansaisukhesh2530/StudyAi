interface SkeletonProps {
  lines?: number;
  className?: string;
}

const SKELETON_LINE_WIDTHS = ['92%', '88%', '95%', '90%', '86%', '93%'];

export function SkeletonText({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, i) => {
        const width = i === lines - 1 ? '65%' : SKELETON_LINE_WIDTHS[i % SKELETON_LINE_WIDTHS.length];
        return (
          <div
            key={i}
            className="skeleton-line"
            style={{ width }}
          />
        );
      })}
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
