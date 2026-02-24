import React from 'react';

// DEPRECATED/UNUSED: This file contains example dashboard components
// The actual dashboards are in AdminDashboard.jsx, TutorDashboard.jsx, and StudentDashboard.jsx
// These are kept as reference or may be historical code

// Example Admin Dashboard component
export const AdminDashboard = () => (
    <div className="dashboard">
        <h1>Admin Dashboard</h1>
        {/* Stats showing overview metrics */}
        <div className="stats-grid">
            {/* Total courses stat card */}
            <div className="stat-card">
                <h3>Total Courses</h3>
                <p>12</p>
            </div>
            {/* Total users stat card */}
            <div className="stat-card">
                <h3>Total Users</h3>
                <p>45</p>
            </div>
            {/* Active sessions stat card */}
            <div className="stat-card">
                <h3>Active Sessions</h3>
                <p>8</p>
            </div>
        </div>
        {/* Recent activity log */}
        <div className="recent-activity">
            <h2>Recent Activities</h2>
            <ul>
                <li>New course "Advanced Python" created by Admin.</li>
                <li>Tutor "John Doe" updated "Web Development".</li>
                <li>New student registered: "Alice Smith".</li>
            </ul>
        </div>
    </div>
);

// Example Tutor Dashboard component
export const TutorDashboard = () => (
    <div className="dashboard">
        <h1>Tutor Dashboard</h1>
        {/* Stats showing tutor overview */}
        <div className="stats-grid">
            {/* My courses stat card */}
            <div className="stat-card">
                <h3>My Courses</h3>
                <p>4</p>
            </div>
            {/* Active students stat card */}
            <div className="stat-card">
                <h3>Active Students</h3>
                <p>120</p>
            </div>
            {/* Pending grades stat card */}
            <div className="stat-card">
                <h3>Pending Grades</h3>
                <p>15</p>
            </div>
        </div>
        {/* Course management section */}
        <div className="course-list">
            <h2>My Assigned Courses</h2>
            <p>Manage your course content and student progress here.</p>
        </div>
    </div>
);

// Example Student Dashboard component
export const StudentDashboard = () => (
    <div className="dashboard">
        <h1>Student Dashboard</h1>
        {/* Stats showing student overview */}
        <div className="stats-grid">
            {/* Enrolled courses stat card */}
            <div className="stat-card">
                <h3>Enrolled Courses</h3>
                <p>3</p>
            </div>
            {/* Completed lessons stat card */}
            <div className="stat-card">
                <h3>Completed Lessons</h3>
                <p>25</p>
            </div>
            {/* Learning hours stat card */}
            <div className="stat-card">
                <h3>Hours Learned</h3>
                <p>42h</p>
            </div>
        </div>
        {/* Continue learning section */}
        <div className="my-courses">
            <h2>Continue Learning</h2>
            <p>Pick up where you left off in your enrolled courses.</p>
        </div>
    </div>
);
