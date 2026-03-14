import { useLocation } from 'react-router-dom';
import { Menu, GraduationCap } from 'lucide-react';

const titles: Record<string, string> = {
  '/tutor': 'AI Tutor',
  '/workspace': 'Learning Workspace',
  '/topics': 'My Topics',
  '/notes': 'Notes',
  '/quizzes': 'Quizzes',
  '/progress': 'Progress',
  '/settings': 'Settings',
};

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const location = useLocation();
  const title = titles[location.pathname] ?? 'StudyAI';

  return (
    <header className="navbar">
      <div className="navbar__left">
        <button className="navbar__menu-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <Menu size={22} />
        </button>
        <span className="navbar__title">{title}</span>
      </div>
      <div className="navbar__right">
        <div className="navbar__logo">
          <GraduationCap size={22} />
          <span>StudyAI</span>
        </div>
      </div>
    </header>
  );
}
