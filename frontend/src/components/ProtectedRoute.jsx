import React from 'react';
// React Router
import { Navigate, useLocation } from 'react-router-dom';
// Custom hook to access authentication data
import { useAuth } from '../context/AuthContext';

// ProtectedRoute: Component that wraps routes to enforce access control
// It checks if user is logged in and has the correct role
const ProtectedRoute = ({ children, roles }) => {
    // Get authentication state from context
    const { user, loading, isAuthenticated } = useAuth();
    // Get current page location (used for redirecting back after login)
    const location = useLocation();

    // While checking if user is authenticated, show loading message
    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    // If user is not logged in, redirect to login page
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If this route requires specific roles and user doesn't have them
    if (roles && !roles.includes(user.role)) {
        // Redirect user to their role-specific dashboard
        const dashboardPath = user.role === 'admin' ? '/admin' : user.role === 'tutor' ? '/tutor' : '/student';
        return <Navigate to={dashboardPath} replace />;
    }

    // User is logged in and has correct role - show the protected page
    return children;
};

export default ProtectedRoute;
