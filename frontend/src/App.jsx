import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/DashboardLayout'
import EpisodesPage from './pages/admin/EpisodesPage'
import EpisodeQuestionsPage from './pages/admin/EpisodeQuestionsPage'
import EpisodeResultsPage from './pages/admin/EpisodeResultsPage'
import EpisodeAnalysisPage from './pages/admin/EpisodeAnalysisPage'
import UsersPage from './pages/admin/UsersPage'
import RegisterPage from './pages/RegisterPage'
import QuizPage from './pages/QuizPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* User-facing */}
        <Route path="/"         element={<RegisterPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/quiz"     element={<QuizPage />} />

        {/* Admin */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/admin/episodes" replace />} />
          <Route path="episodes"                          element={<EpisodesPage />} />
          <Route path="episodes/:episodeId/questions"     element={<EpisodeQuestionsPage />} />
          <Route path="episodes/:episodeId/results"       element={<EpisodeResultsPage />} />
          <Route path="episodes/:episodeId/analysis"     element={<EpisodeAnalysisPage />} />
          <Route path="users"                             element={<UsersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
