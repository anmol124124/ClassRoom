import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// API client for making requests to backend
import api from '../api/api';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    // State for courses list
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);  // Loading state while fetching data
    const [error, setError] = useState('');  // Error messages for data fetching

    // Meeting states
    const [meetings, setMeetings] = useState([]);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingLoading, setMeetingLoading] = useState(false);
    const [copyStatus, setCopyStatus] = useState('');
    const [meetingError, setMeetingError] = useState(''); // Improved error handling
    const [meetingSuccess, setMeetingSuccess] = useState('');

    // Form states - for create/edit modal (Courses)
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
            const response = await api.get('/courses/');
            setCourses(response.data);
        } catch (err) {
            setError('Failed to fetch courses. Please try again.');
            console.error(err);
        }
    };

    // Function to fetch all meetings from backend
    const fetchMeetings = async () => {
        try {
            setMeetingError('');
            const response = await api.get('/meetings/');
            setMeetings(response.data);
        } catch (err) {
            console.error('Failed to fetch meetings:', err);
            setMeetingError('Failed to fetch existing meetings.');
        }
    };

    // Fetch data when component first loads
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchCourses(), fetchMeetings()]);
            setLoading(false);
        };
        loadData();
    }, []);

    // Handle meeting creation
    const handleCreateMeeting = async (e) => {
        e.preventDefault();
        if (!meetingTitle.trim()) return;

        setMeetingLoading(true);
        setMeetingError('');
        setMeetingSuccess('');
        try {
            await api.post('/meetings/', { title: meetingTitle });
            setMeetingTitle('');
            setMeetingSuccess('Meeting link generated successfully!');
            alert('Meeting link generated successfully!');
            setTimeout(() => setMeetingSuccess(''), 5000); // Clear after 5 seconds
            await fetchMeetings();
        } catch (err) {
            console.error('Failed to create meeting:', err);
            setMeetingError(err.response?.data?.detail || 'Error creating meeting. Please try again.');
        } finally {
            setMeetingLoading(false);
        }
    };

    // Handle meeting deletion
    const handleDeleteMeeting = async (meetingId) => {
        if (!window.confirm('Are you sure you want to delete this meeting?')) return;

        try {
            await api.delete(`/meetings/${meetingId}`);
            await fetchMeetings();
        } catch (err) {
            console.error('Failed to delete meeting:', err);
            setMeetingError('Failed to delete meeting. Please try again.');
        }
    };

    // Handle copy link to clipboard
    const copyToClipboard = (url) => {
        navigator.clipboard.writeText(url).then(() => {
            setCopyStatus(url);
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };

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

    // Show loading message while fetching initial data
    if (loading) return <div className="loading">Loading dashboard data...</div>;

    return (
        <div className="dashboard">
            {/* Dashboard header with title */}
            <header className="dashboard-header">
                <h1>Admin Dashboard</h1>
            </header>

            {error && <div className="error-message">{error}</div>}

            {/* Meeting Section - Admin only visibility check */}
            {user?.role === 'admin' && (
                <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <h2>Create Meeting</h2>
                    {meetingError && <div className="error-message" style={{ marginTop: '1rem' }}>{meetingError}</div>}
                    {meetingSuccess && <div className="success-message" style={{ marginTop: '1rem' }}>{meetingSuccess}</div>}
                    <form onSubmit={handleCreateMeeting} style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <input
                            type="text"
                            placeholder="Meeting Title"
                            value={meetingTitle}
                            onChange={(e) => setMeetingTitle(e.target.value)}
                            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                            required
                        />
                        <button type="submit" className="btn-primary" disabled={meetingLoading}>
                            {meetingLoading ? 'Creating...' : 'Create Meeting'}
                        </button>
                    </form>
                </div>
            )}

            {/* Content Tabs/Sections */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>

                {/* Courses section */}
                <div className="course-list-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2>Manage Courses</h2>
                        <button className="btn-primary" onClick={() => handleOpenModal()}>+ Create New Course</button>
                    </div>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Title</th>
                                    <th>Description</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.map(course => (
                                    <tr key={course.id}>
                                        <td>{course.id}</td>
                                        <td>{course.title}</td>
                                        <td>{course.description || <span className="text-muted">No description</span>}</td>
                                        <td>
                                            <div className="action-btns">
                                                <button className="btn-edit" onClick={() => handleOpenModal(course)}>Edit</button>
                                                <button className="btn-delete" onClick={() => handleDeleteClick(course)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {courses.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="text-center">No courses found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Meetings List section */}
                <div className="course-list-section">
                    <h2>Scheduled Meetings</h2>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Room ID</th>
                                    <th>Created At</th>
                                    <th>Link</th>
                                    <th>Action</th>
                                    <th>Delete</th>
                                </tr>
                            </thead>
                            <tbody>
                                {meetings.map(meeting => (
                                    <tr key={meeting.id}>
                                        <td>{meeting.title}</td>
                                        <td>
                                            <code style={{ background: '#f3f4f6', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                                                {meeting.room_id}
                                            </code>
                                        </td>
                                        <td>{new Date(meeting.created_at.endsWith('Z') ? meeting.created_at : meeting.created_at + 'Z').toLocaleString()}</td>
                                        <td>
                                            <button
                                                className="btn-edit"
                                                onClick={() => copyToClipboard(meeting.meeting_url)}
                                                style={{ minWidth: '100px' }}
                                            >
                                                {copyStatus === meeting.meeting_url ? 'Copied Link!' : 'Copy Link'}
                                            </button>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => navigate(`/meeting/${meeting.room_id}`)}
                                                    style={{ padding: '0.4rem 1rem' }}
                                                >
                                                    Join
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleDeleteMeeting(meeting.id)}
                                                    style={{ padding: '0.4rem 1rem' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {meetings.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="text-center">No meetings scheduled.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal for Create/Edit Course */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{isEditing ? 'Edit Course' : 'Create New Course'}</h2>
                        {formError && <div className="error-message">{formError}</div>}
                        <form onSubmit={handleSubmit}>
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
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={currentCourse.description}
                                    onChange={(e) => setCurrentCourse({ ...currentCourse, description: e.target.value })}
                                    placeholder="Enter course details..."
                                    rows="4"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
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
                        {formError && <div className="error-message">{formError}</div>}
                        <p style={{ marginBottom: '1.5rem' }}>Are you sure you want to delete the course <strong>{courseToDelete?.title}</strong>? This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button type="button" className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
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
