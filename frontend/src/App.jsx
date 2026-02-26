import React from 'react';
// React Router: Library for handling navigation between pages
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// AuthProvider: Provides authentication context to all child components
import { AuthProvider } from './context/AuthContext';
// ProtectedRoute: Component that checks if user is logged in and has correct role
import ProtectedRoute from './components/ProtectedRoute';
// Navbar: Navigation bar shown on every page
import Navbar from './components/Navbar';
// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TutorDashboard from './pages/TutorDashboard';
import StudentDashboard from './pages/StudentDashboard';

import MeetingRoom from './pages/MeetingRoom';
import JoinMeeting from './pages/JoinMeeting';

function App() {
  return (
    // AuthProvider: Wraps entire app so all components can access auth context
    <AuthProvider>
      {/* Router: Enables client-side routing for single-page app */}
      <Router>
        <div className="app-container">
          {/* Navbar: Show on every page */}
          <Navbar />
          {/* Routes: Define all page routes */}
          <Routes>
            {/* Login page - accessible to everyone */}
            <Route path="/login" element={<Login />} />

            {/* Admin dashboard - only accessible if user is admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Tutor dashboard - only accessible if user is tutor */}
            <Route
              path="/tutor"
              element={
                <ProtectedRoute roles={['tutor']}>
                  <TutorDashboard />
                </ProtectedRoute>
              }
            />

            {/* Student dashboard - only accessible if user is student */}
            <Route
              path="/student"
              element={
                <ProtectedRoute roles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Join Screen - Capture username before meeting */}
            <Route
              path="/join/:room_id"
              element={
                <ProtectedRoute roles={['admin', 'tutor', 'student']}>
                  <JoinMeeting />
                </ProtectedRoute>
              }
            />

            {/* Meeting Room - accessible by all authenticated roles */}
            <Route
              path="/meeting/:room_id"
              element={
                <ProtectedRoute roles={['admin', 'tutor', 'student']}>
                  <MeetingRoom />
                </ProtectedRoute>
              }
            />

            {/* Redirect root URL to login page */}
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
