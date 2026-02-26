import React, { useState, useEffect } from 'react';
// React Router for navigation
import { useNavigate, useLocation } from 'react-router-dom';
// Custom auth hook
import { useAuth } from '../context/AuthContext';

const Login = () => {
    // State for form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');  // Error messages to display
    const [loading, setLoading] = useState(false);  // Loading state while submitting

    // Get login function from auth context
    const { login } = useAuth();
    // Hook to navigate to different pages
    const navigate = useNavigate();
    // Get location info (used to redirect to intended page after login)
    const location = useLocation();

    // Auto-redirect if user is already logged in
    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser) {
            navigate(`/${currentUser.role}`, { replace: true });
        }
    }, [navigate]);

    // Handle form submission when user clicks "Sign In"
    const handleSubmit = async (e) => {
        e.preventDefault();  // Prevent page reload
        setError('');  // Clear previous errors
        setLoading(true);  // Show loading state

        try {
            // Call login function with email and password
            const user = await login(email, password);
            // Determine where to redirect: originally intended page or role's dashboard
            const from = location.state?.from?.pathname || `/${user.role}`;
            // Navigate to the dashboard
            navigate(from, { replace: true });
        } catch (err) {
            // Show error message if login fails
            setError('Invalid email or password. Please try again.');
        } finally {
            setLoading(false);  // Hide loading state
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1>Course Era</h1>
                <p>Sign in to manage your courses</p>

                {/* Show error message if login failed */}
                {error && <div className="error-message">{error}</div>}

                {/* Login form */}
                <form onSubmit={handleSubmit}>
                    {/* Email input */}
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g. admin@gmail.com"
                            required
                        />
                    </div>

                    {/* Password input */}
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your password"
                            required
                        />
                    </div>

                    {/* Sign In button - Disabled while loading */}
                    <button type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Demo account credentials for testing */}
                <div className="credentials-hint">
                    <p>Demo accounts:</p>
                    <ul>
                        <li>Admin: admin@gmail.com / adminpassword</li>
                        <li>Tutor: tutor@gmail.com / tutorpassword</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Login;
