import React, { useState, useEffect } from 'react';
// API client for making requests to backend
import api from '../api/api';

const AdminDashboard = () => {
    // State for courses list
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);  // Loading state while fetching courses
    const [error, setError] = useState('');  // Error messages for course list

    // Form states - for create/edit modal
    const [showModal, setShowModal] = useState(false);  // Show/hide modal dialog
    const [isEditing, setIsEditing] = useState(false);  // True if editing, false if creating
    const [currentCourse, setCurrentCourse] = useState({ title: '', description: '' });  // Current course being edited
    const [formError, setFormError] = useState('');  // Error messages for form
    const [submitting, setSubmitting] = useState(false);  // Loading state while saving
    
    // States for delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState(null);

    // Function to fetch all courses from backend
    const fetchCourses = async () => {
        try {
            setLoading(true);
            // Make API request to get all courses
            const response = await api.get('/courses/');
            // Update courses list with data from backend
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

    // Open modal for creating new course or editing existing one
    const handleOpenModal = (course = { title: '', description: '' }) => {
        setCurrentCourse(course);
        // isEditing is true if course has an ID (existing course)
        setIsEditing(!!course.id);
        setShowModal(true);
        setFormError('');
    };

    // Close modal and reset form
    const handleCloseModal = () => {
        setShowModal(false);
        setCurrentCourse({ title: '', description: '' });
        setFormError('');
    };

    // Handle form submission for creating/updating course
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);

        try {
            if (isEditing) {
                // Update existing course
                await api.put(`/courses/${currentCourse.id}`, currentCourse);
            } else {
                // Create new course
                await api.post('/courses/', currentCourse);
            }
            // Refresh courses list
            await fetchCourses();
            // Close modal
            handleCloseModal();
        } catch (err) {
            // Show error if save fails
            setFormError(err.response?.data?.detail || 'Failed to save course.');
        } finally {
            setSubmitting(false);
        }
    };

    // Open delete confirmation modal
    const handleDeleteClick = (course) => {
        setCourseToDelete(course);
        setShowDeleteModal(true);
        setFormError('');
    };

    // Confirm and execute course deletion
    const confirmDelete = async () => {
        if (!courseToDelete) return;
        setSubmitting(true);
        try {
            // Send delete request to backend
            await api.delete(`/courses/${courseToDelete.id}`);
            // Refresh courses list
            await fetchCourses();
            // Close delete modal
            setShowDeleteModal(false);
            setCourseToDelete(null);
        } catch (err) {
            setFormError(err.response?.data?.detail || 'Failed to delete course.');
        } finally {
            setSubmitting(false);
        }
    };

    // Show loading message while fetching initial courses
    if (loading && courses.length === 0) return <div className="loading">Loading courses...</div>;

    return (
        <div className="dashboard">
            {/* Dashboard header with title and create button */}
            <header className="dashboard-header">
                <h1>Admin Dashboard</h1>
                {/* Button to open modal for creating new course */}
                <button className="btn-primary" onClick={() => handleOpenModal()}>+ Create New Course</button>
            </header>

            {/* Show error message if fetching courses failed */}
            {error && <div className="error-message">{error}</div>}

            {/* Courses table section */}
            <div className="course-list-section">
                <h2>Manage Courses</h2>
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
                                            <button className="btn-edit" onClick={() => handleOpenModal(course)}>Edit</button>
                                            {/* Delete button - opens delete confirmation */}
                                            <button className="btn-delete" onClick={() => handleDeleteClick(course)}>Delete</button>
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

            {/* Modal for Create/Edit Course */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        {/* Modal title changes based on create vs edit */}
                        <h2>{isEditing ? 'Edit Course' : 'Create New Course'}</h2>
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
                                {/* Save/Create button - button text changes based on action */}
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : (isEditing ? 'Update Course' : 'Create Course')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal for Delete Confirmation */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Confirm Deletion</h2>
                        {/* Show errors from delete operation */}
                        {formError && <div className="error-message">{formError}</div>}
                        {/* Confirmation message with course name */}
                        <p style={{ marginBottom: '1.5rem' }}>Are you sure you want to delete the course <strong>{courseToDelete?.title}</strong>? This action cannot be undone.</p>
                        {/* Action buttons for delete confirmation */}
                        <div className="modal-actions">
                            {/* Cancel - close without deleting */}
                            <button type="button" className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            {/* Confirm delete */}
                            <button type="button" className="btn-delete" onClick={confirmDelete} disabled={submitting}>
                                {submitting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
