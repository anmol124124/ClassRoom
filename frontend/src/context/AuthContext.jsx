import React, { createContext, useContext, useState, useEffect } from 'react';
// jwtDecode: Library to decode JWT tokens and extract data (email, role, expiration)
import { jwtDecode } from 'jwt-decode';
// API: Axios instance for making HTTP requests to backend
import api from '../api/api';

// Create context object - This holds authentication data shared across all components
const AuthContext = createContext();

// AuthProvider component - Provides authentication functionality to entire app
export const AuthProvider = ({ children }) => {
    // State to store logged-in user info (email, role)
    const [user, setUser] = useState(null);
    // State to track if we're still loading authentication info on startup
    const [loading, setLoading] = useState(true);

    // useEffect: Runs when component mounts - Check if user is already logged in
    useEffect(() => {
        // Try to get saved token from browser's local storage
        const token = localStorage.getItem('token');
        if (token) {
            try {
                // Decode the token to extract user data
                const decoded = jwtDecode(token);
                
                // Check if token has expired (exp is in seconds, Date.now() is in milliseconds)
                if (decoded.exp * 1000 < Date.now()) {
                    // Token is expired - remove it and clear user
                    localStorage.removeItem('token');
                    setUser(null);
                } else {
                    // Token is still valid - restore user session
                    setUser({
                        email: decoded.sub,  // 'sub' claim contains the email
                        role: decoded.role
                    });
                }
            } catch (error) {
                // Token is corrupted or invalid
                console.error('Failed to decode token:', error);
                localStorage.removeItem('token');
            }
        }
        // Finished checking - loading is complete
        setLoading(false);
    }, []);

    // Function to handle user login
    const login = async (email, password) => {
        // Create form data (backend expects URL-encoded format, not JSON)
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        try {
            // Send login request to backend
            const response = await api.post('/auth/login', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            // Extract JWT token from response
            const { access_token } = response.data;
            // Save token to local storage so it persists across page refreshes
            localStorage.setItem('token', access_token);

            // Decode token to get user info
            const decoded = jwtDecode(access_token);
            const userData = {
                email: decoded.sub,
                role: decoded.role
            };

            // Update user state
            setUser(userData);
            return userData;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    };

    // Function to handle user logout
    const logout = () => {
        // Remove token from storage
        localStorage.removeItem('token');
        // Clear user state
        setUser(null);
    };

    // Return context provider that passes auth data to all child components
    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to access authentication context
// This makes it easy for any component to get auth data with: const { user, login, logout } = useAuth();
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
