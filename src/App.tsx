import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout';
import TutorPage from './pages/TutorPage';
import WorkspacePage from './pages/WorkspacePage';
import TopicsPage from './pages/TopicsPage';
import NotesPage from './pages/NotesPage';
import QuizzesPage from './pages/QuizzesPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';
import FlashcardsPage from './pages/FlashcardsPage';
import LearningModePage from './pages/LearningModePage';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/tutor" replace />} />
          <Route path="tutor" element={<TutorPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="learn" element={<LearningModePage />} />
          <Route path="topics" element={<TopicsPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="flashcards" element={<FlashcardsPage />} />
          <Route path="quizzes" element={<QuizzesPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/tutor" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
