import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/api';

const MeetingRoom = () => {
    const { room_id } = useParams();
    const navigate = useNavigate();
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Refs for non-reactive state
    const socket = useRef(null);
    const localStreamRef = useRef(null);
    const peerConnections = useRef({}); // { peerId: RTCPeerConnection }
    const myPeerId = useRef(null);

    // Reactive state for UI
    const [peers, setPeers] = useState([]); // Array of peer objects { id, stream }
    const [localStream, setLocalStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    useEffect(() => {
        const fetchMeetingAndSetup = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/meetings/room/${room_id}`);
                setMeeting(response.data);

                // Get local media
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                setLocalStream(stream);

                setupSignaling(room_id, stream);

            } catch (err) {
                console.error('Failed to initialize meeting:', err);
                setError('Could not access camera/microphone or meeting not found.');
            } finally {
                setLoading(false);
            }
        };

        fetchMeetingAndSetup();

        return () => {
            // Cleanup all peer connections and media
            Object.keys(peerConnections.current).forEach(peerId => {
                removePeer(peerId);
            });
            if (socket.current) {
                socket.current.close();
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [room_id]);

    const setupSignaling = (roomId, stream) => {
        // Use the environment variable for the signaling server URL
        const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';
        const socketUrl = `${wsBaseUrl}/ws/${roomId}`;

        console.log(`Connecting to signaling server at: ${socketUrl}`);
        socket.current = new WebSocket(socketUrl);

        socket.current.onopen = () => {
            console.log('Signaling WebSocket connection opened');
        };

        socket.current.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            const { type, sender_id, peer_id, offer, answer, candidate } = data;

            switch (type) {
                case 'init':
                    myPeerId.current = peer_id;
                    console.log('Assigned Peer ID:', peer_id);
                    break;
                case 'join':
                    console.log('New participant joined:', sender_id);
                    // Initiate offer to the new participant
                    createPeerConnection(sender_id, stream, true);
                    break;
                case 'offer':
                    console.log('Received WebRTC offer from:', sender_id);
                    handleOffer(sender_id, offer, stream);
                    break;
                case 'answer':
                    console.log('Received WebRTC answer from:', sender_id);
                    handleAnswer(sender_id, answer);
                    break;
                case 'ice-candidate':
                    handleIceCandidate(sender_id, candidate);
                    break;
                case 'leave':
                    console.log('Participant left:', sender_id);
                    removePeer(sender_id);
                    break;
                default:
                    break;
            }
        };

        socket.current.onclose = () => {
            console.log('Signaling WebSocket closed');
        };

        socket.current.onerror = (err) => {
            console.error('Signaling WebSocket error:', err);
            setError('Lost connection to signaling server.');
        };
    };

    const createPeerConnection = (remotePeerId, stream, isInitiator) => {
        // If PC already exists for this peer, close it first
        if (peerConnections.current[remotePeerId]) {
            peerConnections.current[remotePeerId].close();
        }

        const pc = new RTCPeerConnection(rtcConfig);
        peerConnections.current[remotePeerId] = pc;

        // Add local tracks to the connection
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // Listen for remote tracks
        pc.ontrack = (event) => {
            console.log('Received remote track from:', remotePeerId);
            setPeers(prev => {
                const existing = prev.find(p => p.id === remotePeerId);
                if (existing) {
                    return prev.map(p => p.id === remotePeerId ? { ...p, stream: event.streams[0] } : p);
                }
                return [...prev, { id: remotePeerId, stream: event.streams[0] }];
            });
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socket.current?.readyState === WebSocket.OPEN) {
                socket.current.send(JSON.stringify({
                    type: 'ice-candidate',
                    target_id: remotePeerId,
                    candidate: event.candidate
                }));
            }
        };

        // Handle connection state changes for abrupt disconnections
        pc.onconnectionstatechange = () => {
            console.log(`Connection state for ${remotePeerId}:`, pc.connectionState);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                removePeer(remotePeerId);
            }
        };

        // If initiator, create and send offer when negotiation is needed
        if (isInitiator) {
            pc.onnegotiationneeded = async () => {
                try {
                    console.log('Negotiation needed for:', remotePeerId);
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    if (socket.current?.readyState === WebSocket.OPEN) {
                        socket.current.send(JSON.stringify({
                            type: 'offer',
                            target_id: remotePeerId,
                            offer: offer
                        }));
                    }
                } catch (err) {
                    console.error('Offer creation error:', err);
                }
            };
        }

        return pc;
    };

    const handleOffer = async (remotePeerId, offer, stream) => {
        const pc = createPeerConnection(remotePeerId, stream, false);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (socket.current?.readyState === WebSocket.OPEN) {
                socket.current.send(JSON.stringify({
                    type: 'answer',
                    target_id: remotePeerId,
                    answer: answer
                }));
            }
        } catch (err) {
            console.error('Error handling offer:', err);
        }
    };

    const handleAnswer = async (remotePeerId, answer) => {
        const pc = peerConnections.current[remotePeerId];
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
                console.error('Error handling answer:', err);
            }
        }
    };

    const handleIceCandidate = async (remotePeerId, candidate) => {
        const pc = peerConnections.current[remotePeerId];
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error('Error adding ice candidate:', err);
            }
        }
    };

    const removePeer = (remotePeerId) => {
        console.log('Removing peer:', remotePeerId);
        const pc = peerConnections.current[remotePeerId];
        if (pc) {
            pc.ontrack = null;
            pc.onicecandidate = null;
            pc.onconnectionstatechange = null;
            pc.onnegotiationneeded = null;
            pc.close();
            delete peerConnections.current[remotePeerId];
        }
        setPeers(prev => prev.filter(p => p.id !== remotePeerId));
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    const leaveMeeting = () => {
        navigate(-1);
    };

    if (loading) return <div className="loading" style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Initializing Meeting Experience...</div>;
    if (error) return (
        <div className="error-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <p className="error-message" style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>{error}</p>
            <button className="btn-secondary" onClick={() => navigate(-1)} style={{ padding: '0.8rem 2rem', borderRadius: '8px', cursor: 'pointer' }}>Return to Dashboard</button>
        </div>
    );

    const totalParticipants = peers.length + 1;
    const gridCols = totalParticipants === 1 ? '1fr' : totalParticipants <= 4 ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(300px, 1fr))';

    return (
        <div className="meeting-room-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f3f4f6', color: 'var(--text-main)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ padding: '1rem 2.5rem', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'var(--primary)' }}>{meeting.title}</h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {meeting.room_id}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.4rem 1rem', borderRadius: 'full', fontSize: '0.875rem', fontWeight: '500' }}>
                        <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>
                        {totalParticipants} Online
                    </div>
                </div>
            </header>

            {/* Video Main Area */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: gridCols,
                gridAutoRows: 'auto',
                gap: '1.5rem',
                padding: '2rem',
                overflowY: 'auto',
                justifyContent: 'center',
                alignContent: 'center',
                alignItems: 'center',
                background: '#f3f4f6'
            }}>
                {/* Local Participant */}
                <div key="local-video" style={{
                    position: 'relative',
                    background: '#e5e7eb',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow)',
                    border: '1px solid #d1d5db',
                    aspectRatio: '16/9',
                    maxWidth: totalParticipants === 1 ? '900px' : '100%',
                    width: '100%',
                    justifySelf: 'center'
                }}>
                    <video
                        autoPlay
                        playsInline
                        muted
                        ref={el => { if (el) el.srcObject = localStream; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                    <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(0, 0, 0, 0.6)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', zIndex: 5 }}>
                        You (Host) {isMuted && '🎤❌'} {isVideoOff && '📷❌'}
                    </div>
                </div>

                {/* Remote Participants */}
                {peers.map(peer => (
                    <div key={peer.id} style={{
                        position: 'relative',
                        background: '#e5e7eb',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: 'var(--shadow)',
                        border: '1px solid #d1d5db',
                        aspectRatio: '16/9',
                        width: '100%',
                        justifySelf: 'center'
                    }}>
                        <video
                            autoPlay
                            playsInline
                            ref={el => { if (el) el.srcObject = peer.stream; }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(0, 0, 0, 0.6)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', zIndex: 5 }}>
                            Guest {peer.id.slice(0, 5)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls Bar */}
            <footer style={{ padding: '1.25rem', background: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', borderTop: '1px solid #e5e7eb', zIndex: 20 }}>
                <button
                    onClick={toggleMute}
                    style={{
                        width: '48px', height: '48px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isMuted ? '#f43f5e' : '#e2e8f0', color: isMuted ? '#fff' : '#1e293b', fontSize: '1.25rem', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s',
                        boxShadow: 'var(--shadow)'
                    }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? '🔇' : '🎤'}
                </button>
                <button
                    onClick={toggleVideo}
                    style={{
                        width: '48px', height: '48px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isVideoOff ? '#f43f5e' : '#e2e8f0', color: isVideoOff ? '#fff' : '#1e293b', fontSize: '1.25rem', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s',
                        boxShadow: 'var(--shadow)'
                    }}
                    title={isMuted ? 'Start Video' : 'Stop Video'}
                >
                    {isVideoOff ? '🚫' : '📷'}
                </button>
                <button
                    onClick={leaveMeeting}
                    style={{
                        padding: '0 2rem', height: '48px', borderRadius: '24px', border: 'none', cursor: 'pointer',
                        background: '#f43f5e', color: '#fff', fontWeight: '600', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s',
                        boxShadow: 'var(--shadow)'
                    }}
                >
                    Leave Room
                </button>
            </footer>
        </div>
    );
};

export default MeetingRoom;
