import { NavLink } from 'react-router-dom';
import {
  MessageSquare,
  Layers,
  BookOpen,
  FileText,
  HelpCircle,
  BarChart2,
  Settings,
  GraduationCap,
} from 'lucide-react';

const navItems = [
  { to: '/tutor', icon: MessageSquare, label: 'AI Tutor' },
  { to: '/workspace', icon: Layers, label: 'Workspace' },
  { to: '/topics', icon: BookOpen, label: 'My Topics' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/quizzes', icon: HelpCircle, label: 'Quizzes' },
  { to: '/progress', icon: BarChart2, label: 'Progress' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand">
        <GraduationCap size={28} className="sidebar__brand-icon" />
        {!collapsed && <span className="sidebar__brand-name">StudyAI</span>}
      </div>

      <nav className="sidebar__nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <Icon size={20} className="sidebar__link-icon" />
            {!collapsed && <span className="sidebar__link-label">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
