import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import useScreenRecorder from '../hooks/useScreenRecorder';
import { Mic, MicOff, Video, VideoOff, Circle, Square, PhoneOff, Users, MonitorUp } from 'lucide-react';

const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const VideoTile = ({ peerId, stream, username, isMuted, isLocal, isActiveSpeaker, isVideoDisabled: isVideoDisabledProp, transform = 'none', maxWidth = '100%', totalParticipants = 1 }) => {
    const videoTrack = stream?.getVideoTracks()[0];
    const isVideoDisabled = isVideoDisabledProp !== undefined ? isVideoDisabledProp : (!videoTrack || !videoTrack.enabled);
    const displayLabel = isLocal ? `${username} (You)` : username;

    return (
        <div className={isActiveSpeaker ? 'active-speaker' : ''} style={{
            position: 'relative',
            background: '#1f2937',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            border: '1px solid #d1d5db',
            aspectRatio: '16/9',
            width: '100%',
            maxWidth: maxWidth,
            justifySelf: 'center',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {!isVideoDisabled ? (
                <video
                    autoPlay
                    playsInline
                    muted={isLocal}
                    ref={el => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform }}
                />
            ) : (
                <div style={{
                    width: totalParticipants === 1 ? '120px' : '80px',
                    height: totalParticipants === 1 ? '120px' : '80px',
                    background: '#374151',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: totalParticipants === 1 ? '3rem' : '2rem',
                    color: '#fff',
                    fontWeight: '600'
                }}>
                    {getInitials(username)}
                </div>
            )}

            <div style={{
                position: 'absolute',
                bottom: '1.25rem',
                left: '1.25rem',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                padding: '0.6rem 1.2rem',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                zIndex: 10,
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: isLocal ? '#10b981' : '#3b82f6',
                    boxShadow: `0 0 10px ${isLocal ? '#10b981' : '#3b82f6'}`
                }}></div>
                <span style={{ whiteSpace: 'nowrap' }}>{displayLabel}</span>
                {isMuted && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#ef4444',
                        padding: '4px',
                        borderRadius: '6px',
                        marginLeft: '4px'
                    }}>
                        <MicOff size={14} color="#fff" strokeWidth={2.5} />
                    </div>
                )}
            </div>
        </div>
    );
};

const MeetingRoom = () => {
    const { room_id } = useParams();
    const navigate = useNavigate();
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const { isRecording, recordingTime, recordingStream, formatTime, startRecording, stopRecording } = useScreenRecorder();

    // Refs for non-reactive state
    const socket = useRef(null);
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const peerConnections = useRef({}); // { peerId: RTCPeerConnection }
    const peerNamesRef = useRef({}); // { peerId: username }
    const myPeerId = useRef(null);
    const audioContextRef = useRef(null);
    const analysersRef = useRef({}); // { peerId: { analyser, dataArray } }
    const speakerTimeoutRef = useRef(null);

    // Reactive state for UI
    const [peers, setPeers] = useState([]); // Array of peer objects { id, stream }
    const [localStream, setLocalStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [activePresenterId, setActivePresenterId] = useState(null); // ID of the participant currently sharing screen
    const [activeSpeakerId, setActiveSpeakerId] = useState(null); // ID of the current active speaker
    const [participantNames, setParticipantNames] = useState({}); // UUID -> Name mapping
    const [mutedPeers, setMutedPeers] = useState({}); // UUID -> boolean mapping
    const [cameraOffPeers, setCameraOffPeers] = useState({}); // UUID -> boolean mapping

    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    useEffect(() => {
        const username = localStorage.getItem('username');
        if (!username) {
            navigate(`/join/${room_id}`);
            return;
        }

        const fetchMeetingAndSetup = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/meetings/room/${room_id}`);
                setMeeting(response.data);

                // Get local media
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                setLocalStream(stream);

                // Setup local audio analysis
                setupAudioAnalysis('local', stream);

                setupSignaling(room_id, stream);

            } catch (err) {
                console.error('Failed to initialize meeting:', err);
                setError('Could not access camera/microphone or meeting not found.');
            } finally {
                setLoading(false);
            }
        };

        fetchMeetingAndSetup();

        // Active Speaker Detection Loop
        const detectionInterval = setInterval(() => {
            if (!audioContextRef.current) return;
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }

            let maxVolume = -1;
            let currentLoudestId = null;
            const VOLUME_THRESHOLD = 30; // Min volume to consider someone "speaking"

            Object.entries(analysersRef.current).forEach(([peerId, { analyser, dataArray }]) => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;

                if (average > maxVolume && average > VOLUME_THRESHOLD) {
                    // Check if it's the local user and they are muted
                    if (peerId === 'local' && isMuted) return;

                    maxVolume = average;
                    currentLoudestId = peerId;
                }
            });

            if (currentLoudestId) {
                // If it's local, we'll keep using the 'local' string for ID check
                setActiveSpeakerId(currentLoudestId);
                if (speakerTimeoutRef.current) clearTimeout(speakerTimeoutRef.current);
                speakerTimeoutRef.current = setTimeout(() => {
                    setActiveSpeakerId(null);
                }, 1500); // 1.5s timeout for highlight
            }
        }, 150);

        return () => {
            clearInterval(detectionInterval);
            if (speakerTimeoutRef.current) clearTimeout(speakerTimeoutRef.current);
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
                    // Immediately send joining info with our username
                    socket.current.send(JSON.stringify({
                        type: 'join',
                        roomId: room_id,
                        userId: peer_id,
                        username: localStorage.getItem('username') || 'Guest'
                    }));
                    break;
                case 'participants':
                    console.log('Received participants list:', data.users);
                    if (data.presenter !== undefined) {
                        setActivePresenterId(data.presenter);
                    }
                    const newNames = {};
                    data.users.forEach(u => {
                        peerNamesRef.current[u.userId] = u.username;
                        newNames[u.userId] = u.username;
                    });
                    setParticipantNames(newNames);
                    // Trigger re-render to update names on tiles
                    setPeers(prev => [...prev]);
                    break;
                case 'join':
                    console.log('New participant joined:', sender_id);
                    // Initiate offer to the new participant
                    createPeerConnection(sender_id, true);
                    break;
                case 'offer':
                    console.log('Received WebRTC offer from:', sender_id);
                    handleOffer(sender_id, offer);
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
                    if (activePresenterId === sender_id) setActivePresenterId(null);
                    removePeer(sender_id);
                    break;
                case 'screen-share':
                    console.log('Screen share update from:', sender_id, data.isSharing);
                    setActivePresenterId(data.isSharing ? sender_id : null);
                    break;
                case 'mic-status':
                    console.log('Mic status update from:', sender_id, data.isMuted);
                    setMutedPeers(prev => ({ ...prev, [sender_id]: data.isMuted }));
                    break;
                case 'video-status':
                    console.log('Video status update from:', sender_id, data.isVideoOff);
                    setCameraOffPeers(prev => ({ ...prev, [sender_id]: data.isVideoOff }));
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

    const setupAudioAnalysis = (peerId, stream) => {
        try {
            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) return;

            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }

            const ctx = audioContextRef.current;
            const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            analysersRef.current[peerId] = { analyser, dataArray };
            console.log(`Started audio analysis for: ${peerId}`);
        } catch (err) {
            console.error('Failed to setup audio analysis:', err);
        }
    };

    const createPeerConnection = (remotePeerId, isInitiator) => {
        // If PC already exists for this peer, close it first
        if (peerConnections.current[remotePeerId]) {
            peerConnections.current[remotePeerId].close();
        }

        const pc = new RTCPeerConnection(rtcConfig);
        peerConnections.current[remotePeerId] = pc;

        // Active Stream Sensing: Use screen share if active, otherwise camera
        const currentStream = screenStreamRef.current || localStreamRef.current;
        if (currentStream) {
            console.log(`Adding tracks from ${screenStreamRef.current ? 'screen' : 'camera'} stream to PC for:`, remotePeerId);
            currentStream.getTracks().forEach(track => pc.addTrack(track, currentStream));
        }

        // Listen for remote tracks
        pc.ontrack = (event) => {
            console.log('Received remote track from:', remotePeerId);

            // Setup audio analysis for remote peer
            if (event.track.kind === 'audio') {
                setupAudioAnalysis(remotePeerId, event.streams[0]);
            }

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

    const handleOffer = async (remotePeerId, offer) => {
        const pc = createPeerConnection(remotePeerId, false);
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
        if (analysersRef.current[remotePeerId]) {
            delete analysersRef.current[remotePeerId];
        }
        setPeers(prev => prev.filter(p => p.id !== remotePeerId));
    };


    const toggleMute = () => {
        if (localStreamRef.current) {
            const newMuteStatus = !isMuted;
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !newMuteStatus;
            });
            setIsMuted(newMuteStatus);

            // Broadcast mic status change
            if (socket.current?.readyState === WebSocket.OPEN) {
                socket.current.send(JSON.stringify({
                    type: 'mic-status',
                    userId: myPeerId.current,
                    isMuted: newMuteStatus
                }));
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const newVideoStatus = !isVideoOff;
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = !newVideoStatus;
            });
            setIsVideoOff(newVideoStatus);

            // Broadcast video status change
            if (socket.current?.readyState === WebSocket.OPEN) {
                socket.current.send(JSON.stringify({
                    type: 'video-status',
                    userId: myPeerId.current,
                    isVideoOff: newVideoStatus
                }));
            }
        }
    };

    const leaveMeeting = () => {
        if (isRecording) {
            stopRecording();
        }
        navigate(-1);
    };

    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                let stream;
                if (isRecording && recordingStream) {
                    stream = recordingStream;
                } else {
                    stream = await navigator.mediaDevices.getDisplayMedia({
                        video: { frameRate: 15 }
                    });
                }

                screenStreamRef.current = stream;
                const screenTrack = stream.getVideoTracks()[0];

                // Replace track in all peer connections
                Object.values(peerConnections.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(screenTrack);
                    }
                });

                // Update local preview
                setLocalStream(stream);
                setIsScreenSharing(true);
                setActivePresenterId(myPeerId.current);

                // Broadcast screen share status
                if (socket.current?.readyState === WebSocket.OPEN) {
                    socket.current.send(JSON.stringify({
                        type: 'screen-share',
                        isSharing: true
                    }));
                }

                // Disable camera track if it was active
                if (localStreamRef.current) {
                    localStreamRef.current.getVideoTracks().forEach(track => track.enabled = false);
                }

                // Handle stop sharing from browser UI
                screenTrack.onended = () => {
                    stopScreenShare();
                };

            } catch (err) {
                console.error('Error starting screen share:', err);
            }
        } else {
            stopScreenShare();
        }
    };

    const stopScreenShare = () => {
        // If we are recording, we don't stop the tracks yet because the recorder is using them.
        // The useScreenRecorder hook will handle the cleanup when recording stops.
        if (screenStreamRef.current && !isRecording) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }

        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        if (cameraTrack) {
            cameraTrack.enabled = !isVideoOff;

            // Restore track in all peer connections
            Object.values(peerConnections.current).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video' || s.track === null);
                if (sender) {
                    sender.replaceTrack(cameraTrack);
                }
            });
        }

        setLocalStream(localStreamRef.current);
        setIsScreenSharing(false);
        setActivePresenterId(null);

        // Broadcast video status restoration (camera back on)
        if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
                type: 'video-status',
                userId: myPeerId.current,
                isVideoOff: isVideoOff // Use current camera state
            }));
        }

        // Broadcast screen share stop
        if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
                type: 'screen-share',
                isSharing: false
            }));
        }
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
                    {isRecording && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '0.4rem 1rem', borderRadius: 'full', fontSize: '0.875rem', fontWeight: 'bold' }}>
                            <span style={{ width: '8px', height: '8px', background: '#f43f5e', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></span>
                            REC {formatTime(recordingTime)}
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#ecfdf5', color: '#059669', padding: '0.5rem 1rem', borderRadius: '30px', fontSize: '0.875rem', fontWeight: '600', border: '1px solid #d1fae5' }}>
                        <Users size={16} />
                        {totalParticipants} Online
                    </div>
                </div>
            </header>

            {/* Presentation Banner */}
            {activePresenterId && (
                <div style={{
                    background: '#3b82f6',
                    color: '#fff',
                    padding: '0.6rem 2rem',
                    textAlign: 'center',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    zIndex: 5
                }}>
                    <MonitorUp size={18} />
                    {activePresenterId === myPeerId.current
                        ? 'You are presenting your screen'
                        : `Someone is presenting their screen`}
                </div>
            )}

            {/* Video Main Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                background: '#f3f4f6',
                overflow: 'hidden',
                padding: activePresenterId ? '0' : '2rem',
                position: 'relative'
            }}>
                {activePresenterId ? (
                    // Presentation Layout (Zoom Mode)
                    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                        {/* Main Stage */}
                        <div style={{ flex: 1, background: '#111827', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <div className={activeSpeakerId === (activePresenterId === myPeerId.current ? 'local' : activePresenterId) ? 'active-speaker' : ''} style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '12px', overflow: 'hidden' }}>
                                <video
                                    autoPlay
                                    playsInline
                                    muted={activePresenterId === myPeerId.current}
                                    ref={el => {
                                        if (el) {
                                            let targetStream = null;
                                            if (activePresenterId === myPeerId.current) {
                                                targetStream = localStream;
                                            } else {
                                                const presenter = peers.find(p => p.id === activePresenterId);
                                                if (presenter) targetStream = presenter.stream;
                                            }
                                            if (el.srcObject !== targetStream) {
                                                el.srcObject = targetStream;
                                            }
                                        }
                                    }}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        width: 'auto',
                                        height: 'auto',
                                        objectFit: 'contain',
                                        transform: activePresenterId === myPeerId.current && !isScreenSharing ? 'scaleX(-1)' : 'none'
                                    }}
                                />
                            </div>
                            <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', background: 'rgba(0, 0, 0, 0.6)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', zIndex: 10 }}>
                                {activePresenterId === myPeerId.current ? 'Your Presentation' : `${peerNamesRef.current[activePresenterId] || 'Someone'}'s Presentation`}
                            </div>
                        </div>

                        {/* Sidebar Thumbnails */}
                        <div style={{
                            width: '280px',
                            background: '#1f2937',
                            borderLeft: '1px solid #374151',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            padding: '1rem',
                            overflowY: 'auto'
                        }}>
                            {/* Local Video as Thumbnail (if not presenting) */}
                            {activePresenterId !== myPeerId.current && (
                                <VideoTile
                                    peerId="local"
                                    stream={localStream}
                                    username={localStorage.getItem('username') || 'You'}
                                    isMuted={isMuted}
                                    isLocal={true}
                                    isActiveSpeaker={activeSpeakerId === 'local'}
                                    transform="scaleX(-1)"
                                    totalParticipants={totalParticipants}
                                />
                            )}
                            {/* Remote Peers as Thumbnails */}
                            {peers.map(peer => (
                                peer.id !== activePresenterId && (
                                    <VideoTile
                                        key={peer.id}
                                        peerId={peer.id}
                                        stream={peer.stream}
                                        username={participantNames[peer.id] || 'Guest'}
                                        isMuted={mutedPeers[peer.id] || false}
                                        isVideoDisabled={cameraOffPeers[peer.id]}
                                        isLocal={false}
                                        isActiveSpeaker={activeSpeakerId === peer.id}
                                        totalParticipants={totalParticipants}
                                    />
                                )
                            ))}
                        </div>
                    </div>
                ) : (
                    // Regular Grid Layout
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'grid',
                        gridTemplateColumns: gridCols,
                        gridAutoRows: 'auto',
                        gap: '1.5rem',
                        justifyContent: 'center',
                        alignContent: 'center',
                        alignItems: 'center'
                    }}>
                        {/* Local Participant */}
                        <VideoTile
                            peerId="local"
                            stream={localStream}
                            username={localStorage.getItem('username') || 'You'}
                            isMuted={isMuted}
                            isVideoDisabled={isVideoOff}
                            isLocal={true}
                            isActiveSpeaker={activeSpeakerId === 'local'}
                            transform={isScreenSharing ? 'none' : 'scaleX(-1)'}
                            maxWidth={totalParticipants === 1 ? '960px' : '100%'}
                            totalParticipants={totalParticipants}
                        />

                        {/* Remote Participants */}
                        {peers.map(peer => (
                            <VideoTile
                                key={peer.id}
                                peerId={peer.id}
                                stream={peer.stream}
                                username={participantNames[peer.id] || 'Guest'}
                                isMuted={mutedPeers[peer.id] || false}
                                isVideoDisabled={cameraOffPeers[peer.id]}
                                isLocal={false}
                                isActiveSpeaker={activeSpeakerId === peer.id}
                                totalParticipants={totalParticipants}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <footer style={{
                padding: '1.5rem',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '1.25rem',
                borderTop: '1px solid #e5e7eb',
                zIndex: 20,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.05)'
            }}>
                <button
                    onClick={toggleMute}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isMuted ? '#ef4444' : '#f1f5f9', color: isMuted ? '#fff' : '#475569',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        outline: 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <button
                    onClick={toggleVideo}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isVideoOff ? '#ef4444' : '#f1f5f9', color: isVideoOff ? '#fff' : '#475569',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        outline: 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; }}
                    title={isVideoOff ? 'Start Video' : 'Stop Video'}
                >
                    {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                </button>

                {/* Recording Button */}
                <button
                    onClick={() => isRecording ? stopRecording() : startRecording(isScreenSharing ? screenStreamRef.current : null)}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isRecording ? '#ef4444' : '#f1f5f9', color: isRecording ? '#fff' : '#475569',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        outline: 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; }}
                    title={isRecording ? 'Stop Recording' : 'Start Recording'}
                    disabled={isRecording === false && false} // Placeholder for potential future disable logic
                >
                    {isRecording ? <Square size={24} fill="currentColor" /> : <Circle size={24} fill={isRecording ? 'currentColor' : 'none'} />}
                </button>

                {/* Screen Share Button */}
                <button
                    onClick={toggleScreenShare}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isScreenSharing ? '#3b82f6' : '#f1f5f9', color: isScreenSharing ? '#fff' : '#475569',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        outline: 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; }}
                    title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                >
                    <MonitorUp size={24} />
                </button>

                <button
                    onClick={leaveMeeting}
                    style={{
                        padding: '0 2rem', height: '56px', borderRadius: '30px', border: 'none', cursor: 'pointer',
                        background: '#f43f5e', color: '#fff', fontWeight: 'bold', fontSize: '0.95rem',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 14px 0 rgba(244, 63, 94, 0.39)',
                        outline: 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(244, 63, 94, 0.43)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(244, 63, 94, 0.39)'; }}
                >
                    <PhoneOff size={20} />
                    Leave Room
                </button>
            </footer>
        </div>
    );
};

export default MeetingRoom;
