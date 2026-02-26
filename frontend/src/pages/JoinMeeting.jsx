import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const JoinMeeting = () => {
    const { room_id } = useParams();
    const navigate = useNavigate();
    const [name, setName] = useState('');

    const handleJoin = (e) => {
        e.preventDefault();
        if (name.trim()) {
            localStorage.setItem('username', name.trim());
            navigate(`/meeting/${room_id}`);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#f3f4f6'
        }}>
            <div style={{
                background: '#fff',
                padding: '2.5rem',
                borderRadius: '16px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <h1 style={{ color: '#008080', marginBottom: '0.5rem' }}>Ready to Join?</h1>
                <p style={{ color: '#64748b', marginBottom: '2rem' }}>Enter your name to appear in the meeting</p>

                <form onSubmit={handleJoin}>
                    <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Your Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Rahul Verma"
                            required
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                border: '2px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#008080'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!name.trim()}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: '#008080',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            opacity: name.trim() ? 1 : 0.7,
                            transition: 'background 0.2s'
                        }}
                    >
                        Join Meeting
                    </button>
                </form>
            </div>
        </div>
    );
};

export default JoinMeeting;
