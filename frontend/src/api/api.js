// Axios: HTTP client library for making requests to backend API
import axios from 'axios';

// Create an Axios instance with base URL pointing to our backend server
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000',  // Backend server address
    headers: {
        'Content-Type': 'application/json',  // Send/receive JSON
    },
});

// REQUEST INTERCEPTOR: Runs before every request to the API
// Purpose: Automatically add authentication token to all requests
api.interceptors.request.use(
    (config) => {
        // Get the JWT token from browser's local storage
        const token = localStorage.getItem('token');
        if (token) {
            // Add token to Authorization header for authentication
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        // If there's an error before sending, reject it
        return Promise.reject(error);
    }
);

// RESPONSE INTERCEPTOR: Runs after every response from the API
// Purpose: Handle authentication errors (like expired tokens)
api.interceptors.response.use(
    (response) => response,  // If successful, return response as-is
    (error) => {
        // Check if error is a 401 (Unauthorized - token expired or invalid)
        if (error.response && error.response.status === 401) {
            // Remove the invalid token from storage
            localStorage.removeItem('token');
            // Redirect user to login page
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Export the configured API instance for use in other files
export default api;
