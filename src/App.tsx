import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import TutorPage from './pages/TutorPage';
import WorkspacePage from './pages/WorkspacePage';
import TopicsPage from './pages/TopicsPage';
import NotesPage from './pages/NotesPage';
import QuizzesPage from './pages/QuizzesPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';
import FlashcardsPage from './pages/FlashcardsPage';
import LearningModePage from './pages/LearningModePage';
import AuthPage from './pages/AuthPage';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
        <Route path="*" element={<Navigate to="/tutor" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
