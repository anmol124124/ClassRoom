import React, { useState, useEffect } from 'react';
// API client for making requests to backend
import api from '../api/api';

const TutorDashboard = () => {
    // State for courses list
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);  // Loading state while fetching
    const [error, setError] = useState('');  // Error messages

    // Form states - for edit modal
    const [showModal, setShowModal] = useState(false);  // Show/hide modal
    const [currentCourse, setCurrentCourse] = useState({ title: '', description: '' });  // Course being edited
    const [formError, setFormError] = useState('');  // Form error messages
    const [submitting, setSubmitting] = useState(false);  // Loading state while saving

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

    // Open modal to edit a course
    const handleOpenEditModal = (course) => {
        setCurrentCourse(course);
        setShowModal(true);
        setFormError('');
    };

    // Close modal and reset form
    const handleCloseModal = () => {
        setShowModal(false);
        setCurrentCourse({ title: '', description: '' });
        setFormError('');
    };

    // Handle form submission for updating course
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);

        try {
            // Send update request to backend
            await api.put(`/courses/${currentCourse.id}`, currentCourse);
            // Refresh courses list
            await fetchCourses();
            // Close modal
            handleCloseModal();
        } catch (err) {
            // Show error if update fails
            setFormError(err.response?.data?.detail || 'Failed to update course.');
        } finally {
            setSubmitting(false);
        }
    };

    // Show loading message while fetching initial courses
    if (loading && courses.length === 0) return <div className="loading">Loading courses...</div>;

    return (
        <div className="dashboard">
            {/* Dashboard header */}
            <header className="dashboard-header">
                <h1>Tutor Dashboard</h1>
                <p className="text-muted">Manage assigned course content</p>
            </header>

            {/* Show error if fetching failed */}
            {error && <div className="error-message">{error}</div>}

            {/* Courses table section */}
            <div className="course-list-section">
                <h2>My Courses</h2>
                <div className="table-responsive">
                    <table className="admin-table">
                        {/* Table header */}
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Title</th>
                                <th>Description</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        {/* Table body - list all courses */}
                        <tbody>
                            {courses.map(course => (
                                <tr key={course.id}>
                                    <td>{course.id}</td>
                                    <td>{course.title}</td>
                                    {/* Show "No description" if course has no description */}
                                    <td>{course.description || <span className="text-muted">No description</span>}</td>
                                    <td>
                                        <div className="action-btns">
                                            {/* Edit button - opens modal with course data */}
                                            <button className="btn-edit" onClick={() => handleOpenEditModal(course)}>Edit</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {/* Show message if no courses exist */}
                            {courses.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center">No courses found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Edit Course */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Edit Course</h2>
                        {/* Show form errors if any */}
                        {formError && <div className="error-message">{formError}</div>}
                        {/* Form for course data */}
                        <form onSubmit={handleSubmit}>
                            {/* Course title input */}
                            <div className="form-group">
                                <label>Course Title</label>
                                <input
                                    type="text"
                                    value={currentCourse.title}
                                    onChange={(e) => setCurrentCourse({ ...currentCourse, title: e.target.value })}
                                    placeholder="e.g. Advanced React"
                                    required
                                />
                            </div>
                            {/* Course description input */}
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={currentCourse.description}
                                    onChange={(e) => setCurrentCourse({ ...currentCourse, description: e.target.value })}
                                    placeholder="Enter course details..."
                                    rows="4"
                                />
                            </div>
                            {/* Modal action buttons */}
                            <div className="modal-actions">
                                {/* Cancel button */}
                                <button type="button" className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
                                {/* Save button */}
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Update Course'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TutorDashboard;
