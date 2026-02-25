import React, { useState, useEffect } from 'react';
// API client for making requests to backend
import api from '../api/api';

import { useNavigate } from 'react-router-dom';

const TutorDashboard = () => {
    const navigate = useNavigate();
    // State for courses list
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);  // Loading state while fetching
    const [error, setError] = useState('');  // Error messages

    // Meeting states
    const [meetings, setMeetings] = useState([]);
    const [copyStatus, setCopyStatus] = useState('');

    // Form states - for edit modal
    const [showModal, setShowModal] = useState(false);  // Show/hide modal
    const [currentCourse, setCurrentCourse] = useState({ title: '', description: '' });  // Course being edited
    const [formError, setFormError] = useState('');  // Form error messages
    const [submitting, setSubmitting] = useState(false);  // Loading state while saving

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
            const response = await api.get('/meetings/');
            setMeetings(response.data);
        } catch (err) {
            console.error('Failed to fetch meetings:', err);
            setError(prev => prev ? prev : 'Some data failed to load. Please refresh.');
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

    // Handle join meeting
    const handleJoinMeeting = (roomId) => {
        navigate(`/meeting/${roomId}`);
    };

    // Open modal to edit a course
    const handleOpenEditModal = (course) => {
        setCurrentCourse(course);
        setShowModal(true);
        setFormError('');
    };

    // Handle copy link to clipboard
    const copyToClipboard = (url) => {
        navigator.clipboard.writeText(url).then(() => {
            setCopyStatus(url);
            setTimeout(() => setCopyStatus(''), 2000);
        });
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

    // Show loading message while fetching initial data
    if (loading) return <div className="loading">Loading dashboard data...</div>;

    return (
        <div className="dashboard">
            {/* Dashboard header */}
            <header className="dashboard-header">
                <h1>Tutor Dashboard</h1>
                <p className="text-muted">Manage assigned course content and join meetings</p>
            </header>

            {/* Show error if fetching failed */}
            {error && <div className="error-message">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                {/* Courses table section */}
                <div className="course-list-section">
                    <h2>My Courses</h2>
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
                                                <button className="btn-edit" onClick={() => handleOpenEditModal(course)}>Edit</button>
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
                                            <button
                                                className="btn-primary"
                                                onClick={() => handleJoinMeeting(meeting.room_id)}
                                                style={{ padding: '0.4rem 1rem' }}
                                            >
                                                Join
                                            </button>
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

            {/* Modal for Edit Course */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Edit Course</h2>
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
