import React, { useState, useEffect } from 'react';
// API client for making requests to backend
import api from '../api/api';

const StudentDashboard = () => {
    // State for courses list
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);  // Loading state while fetching
    const [error, setError] = useState('');  // Error messages

    // Function to fetch all courses from backend
    const fetchCourses = async () => {
        try {
            setLoading(true);
            // Make API request to get all courses
            const response = await api.get('/courses/');
            // Update courses list
            setCourses(response.data);
        } catch (err) {
            setError('Failed to fetch courses. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch courses when component first loads
    useEffect(() => {
        fetchCourses();
    }, []);

    // Show loading message while fetching initial courses
    if (loading && courses.length === 0) return <div className="loading">Loading courses...</div>;

    return (
        <div className="dashboard">
            {/* Dashboard header */}
            <header className="dashboard-header">
                <div>
                    <h1>Student Dashboard</h1>
                    <p className="text-muted">Browse and explore available courses</p>
                </div>
            </header>

            {/* Show error if fetching failed */}
            {error && <div className="error-message">{error}</div>}

            {/* Display courses as cards in a grid layout */}
            <div className="course-grid">
                {courses.map(course => (
                    // Each course is displayed as a card
                    <div key={course.id} className="stat-card course-card">
                        {/* Course title */}
                        <h3>{course.title}</h3>
                        {/* Course description or default text if none exists */}
                        <p>{course.description || "No description available for this course."}</p>
                        {/* Footer section with course ID and action button */}
                        <div className="course-footer">
                            {/* Display the course ID */}
                            <span className="course-id">ID: {course.id}</span>
                            {/* View details button - currently shows a placeholder message */}
                            <button className="btn-edit" onClick={() => alert('Enrollment feature coming soon!')}>View Details</button>
                        </div>
                    </div>
                ))}
                {/* Show message if no courses are available */}
                {courses.length === 0 && (
                    <div className="text-center" style={{ gridColumn: '1 / -1', padding: '3rem' }}>
                        <p className="text-muted">No courses are currently available.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentDashboard;
