import React from 'react';
// React Router hooks
import { Link, useNavigate } from 'react-router-dom';
// Custom hook to access authentication data
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    // Get user info and logout function from auth context
    const { user, logout } = useAuth();
    // Hook to navigate to different pages programmatically
    const navigate = useNavigate();

    // Function to handle logout button click
    const handleLogout = () => {
        logout();  // Clear user session
        navigate('/login');  // Go back to login page
    };

    // Don't show navbar if user is not logged in
    if (!user) return null;

    return (
        <nav className="navbar">
            {/* Logo/Brand - Click to go to user's dashboard */}
            <div className="nav-brand">
                {/* Navigate to user's role-specific dashboard */}
                <Link to={`/${user.role}`}>Course Era</Link>
            </div>
            {/* Right side of navbar - User role and logout button */}
            <div className="nav-links">
                {/* Display user's role (admin, tutor, or student) */}
                <span className="role-tag">{user.role}</span>
                {/* Logout button */}
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
        </nav>
    );
};

export default Navbar;
