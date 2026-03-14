import { BookOpen, Brain, Globe, Target } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface ExplanationSection {
  key: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  content: string;
}

const SECTION_MAP: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  'topic overview': { icon: BookOpen, color: '#6366f1' },
  'key concepts': { icon: Brain, color: '#a855f7' },
  'real-world example': { icon: Globe, color: '#10b981' },
  'key takeaways': { icon: Target, color: '#f59e0b' },
};

function parseSections(markdown: string): ExplanationSection[] {
  const lines = markdown.split('\n');
  const sections: ExplanationSection[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentTitle && currentLines.length > 0) {
        const key = currentTitle.toLowerCase().trim();
        const meta = SECTION_MAP[key] ?? SECTION_MAP['topic overview'];
        sections.push({ key, title: currentTitle, icon: meta.icon, color: meta.color, content: currentLines.join('\n').trim() });
      }
      currentTitle = line.replace(/^##\s+/, '').trim();
      currentLines = [];
    } else if (currentTitle) {
      currentLines.push(line);
    }
  }

  if (currentTitle && currentLines.length > 0) {
    const key = currentTitle.toLowerCase().trim();
    const meta = SECTION_MAP[key] ?? Object.values(SECTION_MAP)[sections.length % 4];
    sections.push({ key, title: currentTitle, icon: meta.icon, color: meta.color, content: currentLines.join('\n').trim() });
  }

  // If no sections found, render as a single block
  if (sections.length === 0) {
    sections.push({ key: 'overview', title: 'Explanation', icon: BookOpen, color: '#6366f1', content: markdown });
  }

  return sections;
}

interface StructuredExplanationProps {
  content: string;
}

export default function StructuredExplanation({ content }: StructuredExplanationProps) {
  const sections = parseSections(content);

  return (
    <div className="structured-explanation">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <div key={section.key} className="explanation-section">
            <div className="explanation-section__header" style={{ '--section-color': section.color } as React.CSSProperties}>
              <Icon size={18} className="explanation-section__icon" />
              <h3 className="explanation-section__title">{section.title}</h3>
            </div>
            <div className="explanation-section__body">
              <MarkdownRenderer content={section.content} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
