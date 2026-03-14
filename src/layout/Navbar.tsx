import { useLocation } from 'react-router-dom';
import { Menu, GraduationCap, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const titles: Record<string, string> = {
  '/tutor': 'AI Tutor',
  '/workspace': 'Learning Workspace',
  '/learn': 'Learning Mode',
  '/topics': 'My Topics',
  '/notes': 'Notes',
  '/flashcards': 'Flashcards',
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
  const { user, configured, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar__left">
        <button className="navbar__menu-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <Menu size={22} />
        </button>
        <span className="navbar__title">{title}</span>
      </div>
      <div className="navbar__right">
        {configured && user && (
          <>
            <div className="navbar__user" title={user.email ?? 'Signed in user'}>
              {user.email ?? 'User'}
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => void logout()}>
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </>
        )}
        <div className="navbar__logo">
          <GraduationCap size={22} />
          <span>StudyAI</span>
        </div>
      </div>
    </header>
  );
}
