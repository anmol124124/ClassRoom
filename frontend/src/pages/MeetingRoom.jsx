import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import useScreenRecorder from '../hooks/useScreenRecorder';
import { Mic, MicOff, Video, VideoOff, Circle, Square, PhoneOff, Users, MonitorUp, Hand, X, MessageSquare, Send, Image as ImageIcon, Upload, Settings, Check, XCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { BackgroundProcessor } from '../utils/BackgroundProcessor';




const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const VideoTile = ({ peerId, stream, username, isMuted, isHandRaised, isLocal, isActiveSpeaker, isVideoDisabled: isVideoDisabledProp, transform = 'none', maxWidth = '100%', totalParticipants = 1 }) => {
    const videoTrack = stream?.getVideoTracks()[0];
    const isVideoDisabled = isVideoDisabledProp !== undefined ? isVideoDisabledProp : (!videoTrack || !videoTrack.enabled);
    const displayLabel = isLocal ? `${username} (You)` : username;

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0, minHeight: 0 }}>
            <div className={isActiveSpeaker ? 'active-speaker' : ''} style={{
                position: 'relative',
                background: '#1f2937',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                border: '1px solid #d1d5db',
                aspectRatio: '16/9',
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
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

                {isHandRaised && (
                    <div style={{
                        position: 'absolute',
                        top: '1.25rem',
                        right: '1.25rem',
                        background: '#fbbf24',
                        padding: '8px',
                        borderRadius: '50%',
                        color: '#000',
                        boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)',
                        zIndex: 15,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Hand size={20} fill="currentColor" />
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
        </div>
    );
};

const MeetingRoom = () => {
    const { user: authUser } = useAuth();
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
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState({}); // UUID -> boolean mapping
    const [toast, setToast] = useState(null); // { message, id }
    const [showParticipants, setShowParticipants] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [myRole, setMyRole] = useState('student');
    const [isWaiting, setIsWaiting] = useState(false);
    const [isRejected, setIsRejected] = useState(false);
    const [rejectedReason, setRejectedReason] = useState(null); // 'session-replaced', 'denied'
    const [joinRequests, setJoinRequests] = useState([]);
    const [showJoinRequests, setShowJoinRequests] = useState(false);
    const prevPeersLengthRef = useRef(0);
    const chatEndRef = useRef(null);

    // Background features state
    const [backgroundEffect, setBackgroundEffect] = useState('none');
    const [bgImageUrl, setBgImageUrl] = useState('');
    const [showBgSettings, setShowBgSettings] = useState(false);
    const backgroundProcessorRef = useRef(null);
    const backgroundVideoRef = useRef(null); // Hidden video element for background processing

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

    const cleanupAllSessions = () => {
        console.log('Performing deep cleanup of all sessions and media...');

        // Stop all peer connections
        if (peerConnections.current) {
            Object.keys(peerConnections.current).forEach(peerId => {
                removePeer(peerId);
            });
        }

        // Close socket
        if (socket.current) {
            socket.current.close();
        }

        // Stop camera/mic tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped local track: ${track.kind}`);
            });
            localStreamRef.current = null;
        }

        // Stop screen share tracks
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped screen track: ${track.kind}`);
            });
            screenStreamRef.current = null;
        }

        // Cleanup hidden video element
        if (backgroundVideoRef.current) {
            backgroundVideoRef.current.srcObject = null;
            if (backgroundVideoRef.current.parentNode) {
                backgroundVideoRef.current.parentNode.removeChild(backgroundVideoRef.current);
            }
            backgroundVideoRef.current = null;
        }
    };



    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    useEffect(() => {
        const username = localStorage.getItem('username');
        const email = authUser?.email || '';
        const role = (email === 'admin@gmail.com' || authUser?.role === 'admin') ? 'admin' : 'student';
        setMyRole(role);

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

                // Setup Background Processor
                if (!backgroundProcessorRef.current) {
                    backgroundProcessorRef.current = new BackgroundProcessor();
                }

                // Add hidden video for processing if it doesn't exist
                if (!backgroundVideoRef.current) {
                    const video = document.createElement('video');
                    video.muted = true;
                    video.playsInline = true;
                    video.autoplay = true;
                    video.style.position = 'fixed';
                    video.style.top = '-1000px';
                    video.style.left = '-1000px';
                    video.style.width = '1px';
                    video.style.height = '1px';
                    video.style.opacity = '0';
                    video.id = 'background-proc-video';
                    document.body.appendChild(video);
                    backgroundVideoRef.current = video;
                }


                backgroundVideoRef.current.srcObject = stream;
                await backgroundVideoRef.current.play();
                backgroundProcessorRef.current.start(backgroundVideoRef.current);

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
            cleanupAllSessions();
        };

    }, [room_id, authUser]);

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
                    console.log('Temporary Peer ID:', peer_id);
                    const email = authUser?.email || '';
                    const role = (email === 'admin@gmail.com' || authUser?.role === 'admin') ? 'admin' : 'student';

                    // We use email as the stable userId for session enforcement
                    const stableUserId = email || peer_id;
                    myPeerId.current = stableUserId;

                    // Immediately send joining info
                    socket.current.send(JSON.stringify({
                        type: 'join',
                        roomId: room_id,
                        userId: stableUserId,
                        username: localStorage.getItem('username') || 'Guest',
                        role: role
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

                    // Sync join requests and toast: if someone is now a participant, they are no longer waiting
                    setJoinRequests(prev => {
                        const filtered = prev.filter(r => !data.users.some(u => u.userId === r.userId));
                        return filtered;
                    });

                    setToast(prev => {
                        if (prev?.type === 'join-request' && data.users.some(u => u.userId === prev.targetUserId)) {
                            return null;
                        }
                        return prev;
                    });

                    // Trigger re-render to update names on tiles
                    setPeers(prev => [...prev]);
                    break;
                case 'join':
                    console.log('New participant joined:', sender_id);
                    // Clear join request and toast for this user if they just joined (already approved)
                    setJoinRequests(prev => prev.filter(r => r.userId !== sender_id));
                    setToast(prev => (prev?.targetUserId === sender_id ? null : prev));

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

                    // Clear join request and toast if they left while waiting
                    setJoinRequests(prev => prev.filter(r => r.userId !== sender_id));
                    setToast(prev => (prev?.targetUserId === sender_id ? null : prev));

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
                case 'raise-hand':
                    console.log('Hand raise update from:', sender_id, data.isRaised);
                    setRaisedHands(prev => ({ ...prev, [sender_id]: data.isRaised }));
                    if (data.isRaised) {
                        setToast({
                            message: `${peerNamesRef.current[sender_id] || 'Someone'} raised their hand ✋`,
                            id: Date.now()
                        });
                        setTimeout(() => setToast(null), 4000);
                    }
                    break;
                case 'chat-message':
                    console.log('Received chat message:', data);
                    setChatMessages(prev => [...prev, data]);
                    if (!isChatOpen) {
                        setUnreadCount(count => count + 1);
                        // Play notification sound for others' messages
                        if (data.userId !== myPeerId.current) {
                            new Audio('/sounds/message.mp3').play().catch(() => { });
                        }
                    }
                    break;
                case 'chat-history':
                    console.log('Received chat history:', data.history);
                    setChatMessages(data.history);
                    break;
                case 'kicked':
                    if (data.reason === 'session-replaced') {
                        console.warn('Session replaced by another tab. Cleaning up media...');
                        cleanupAllSessions();
                        setIsRejected(true);
                        setRejectedReason('session-replaced');
                    } else {
                        alert(data.message || 'You were removed by the host');
                        window.location.href = '/';
                    }
                    break;
                case 'user-kicked-notification':
                    setToast({
                        message: data.message,
                        id: Date.now()
                    });
                    setTimeout(() => setToast(null), 4000);
                    break;
                case 'waiting-for-approval':
                    console.log('Moved to waiting room');
                    setIsWaiting(true);
                    break;
                case 'join-request':
                    console.log('Incoming join request:', data);
                    setJoinRequests(prev => {
                        if (prev.find(r => r.userId === data.userId)) return prev;
                        return [...prev, { userId: data.userId, username: data.username }];
                    });
                    setToast({
                        message: `${data.username} wants to join`,
                        id: Date.now(),
                        type: 'join-request',
                        targetUserId: data.userId
                    });
                    break;
                case 'join-approved':
                    console.log('Join approved!');
                    setIsWaiting(false);
                    // Now that we are approved, we can initialize WebRTC by being notified of participants
                    break;
                case 'join-rejected':
                    console.log('Join rejected');
                    setIsRejected(true);
                    break;
                case 'waiting-users-list':
                    console.log('Received waiting users list:', data.users);
                    setJoinRequests(data.users);
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



    // Sound effects for join/leave
    useEffect(() => {
        if (peers.length > prevPeersLengthRef.current) {
            // New participant joined
            const audio = new Audio('/sounds/join.mp3');
            audio.play().catch(e => console.log('Sound play error:', e));
        } else if (peers.length < prevPeersLengthRef.current) {
            // Participant left
            const audio = new Audio('/sounds/leave.mp3');
            audio.play().catch(e => console.log('Sound play error:', e));
        }
        prevPeersLengthRef.current = peers.length;
    }, [peers]);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, isChatOpen]);

    const toggleParticipants = () => {
        const nextState = !showParticipants;
        setShowParticipants(nextState);
        if (nextState) setIsChatOpen(false); // Mutually exclusive
    };

    const toggleChat = () => {
        const nextState = !isChatOpen;
        setIsChatOpen(nextState);
        if (nextState) {
            setShowParticipants(false); // Mutually exclusive
            setUnreadCount(0); // Reset unread count when opening
        }
    };

    const handleRemoveParticipant = (targetUserId) => {
        if (myRole !== 'admin') return;

        if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
                type: 'kick-user',
                targetUserId: targetUserId,
                roomId: room_id
            }));
        }
    };

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        if (!chatInput.trim()) return;

        if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
                type: 'chat-message',
                roomId: room_id,
                userId: myPeerId.current,
                username: localStorage.getItem('username') || 'Guest',
                message: chatInput,
                timestamp: Date.now()
            }));
            setChatInput('');
        }
    };

    const handleChatKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const toggleMute = () => {
        const originalStream = localStreamRef.current; // This might be original or processed
        if (originalStream) {
            const newMuteStatus = !isMuted;
            originalStream.getAudioTracks().forEach(track => {
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
        const stream = localStreamRef.current;
        if (stream) {
            const newVideoStatus = !isVideoOff;

            // Disable/Enable the current active tracks (could be original or processed)
            stream.getVideoTracks().forEach(track => {
                track.enabled = !newVideoStatus;
            });

            // CRITICAL: Also disable/enable the original camera tracks if we are in background mode
            // This ensures the camera light actually goes off.
            if (backgroundVideoRef.current?.srcObject) {
                backgroundVideoRef.current.srcObject.getVideoTracks().forEach(track => {
                    track.enabled = !newVideoStatus;
                });
            }

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


    const toggleHandRaise = () => {
        const newStatus = !isHandRaised;
        setIsHandRaised(newStatus);
        if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
                type: 'raise-hand',
                userId: myPeerId.current,
                isRaised: newStatus
            }));
        }
    };

    const approveUser = (targetUserId) => {
        if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
                type: 'approve-user',
                targetUserId
            }));
            setJoinRequests(prev => prev.filter(r => r.userId !== targetUserId));
            setToast(prev => (prev?.targetUserId === targetUserId ? null : prev));
        }
    };

    const rejectUser = (targetUserId) => {
        if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({
                type: 'reject-user',
                targetUserId
            }));
            setJoinRequests(prev => prev.filter(r => r.userId !== targetUserId));
            setToast(prev => (prev?.targetUserId === targetUserId ? null : prev));
        }
    };

    const handleBackgroundChange = async (type) => {
        let url = '';
        let effectType = type;

        if (type === 'library') {
            url = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80';
            effectType = 'image';
            setBackgroundEffect('image');
        } else if (type === 'office') {
            url = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80';
            effectType = 'image';
            setBackgroundEffect('image');
        } else {
            setBackgroundEffect(type);
        }

        setBgImageUrl(url);

        if (backgroundProcessorRef.current) {
            backgroundProcessorRef.current.setEffect(effectType, url);

            // Get the correct track to send
            const processedTrack = backgroundProcessorRef.current.getStream().getVideoTracks()[0];
            const originalStream = backgroundVideoRef.current?.srcObject;
            const originalTrack = originalStream?.getVideoTracks()[0];
            const videoTrack = type === 'none' ? originalTrack : processedTrack;

            if (videoTrack) {
                // Keep the enabled state in sync
                videoTrack.enabled = !isVideoOff;

                // CRITICAL: Update the ref so new connections and toggleVideo use the right tracks
                const newStream = new MediaStream([videoTrack, ...localStreamRef.current.getAudioTracks()]);
                localStreamRef.current = newStream;
                setLocalStream(newStream);

                // Replace track in all active peer connections
                Object.values(peerConnections.current).forEach(async (pc) => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        try {
                            await sender.replaceTrack(videoTrack);
                        } catch (err) {
                            console.error('Error replacing track for peer:', err);
                        }
                    }
                });
            }
        }
    };


    const handleCustomBackgroundUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target.result;
                setBgImageUrl(url);
                setBackgroundEffect('custom');

                if (backgroundProcessorRef.current) {
                    backgroundProcessorRef.current.setEffect('image', url);

                    const processedTrack = backgroundProcessorRef.current.getStream().getVideoTracks()[0];
                    if (processedTrack) {
                        processedTrack.enabled = !isVideoOff;
                        const newStream = new MediaStream([processedTrack, ...localStreamRef.current.getAudioTracks()]);
                        localStreamRef.current = newStream;
                        setLocalStream(newStream);

                        Object.values(peerConnections.current).forEach(async (pc) => {
                            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                            if (sender) {
                                try {
                                    await sender.replaceTrack(processedTrack);
                                } catch (err) {
                                    console.error('Error replacing track for peer:', err);
                                }
                            }
                        });
                    }
                }
            };

            reader.readAsDataURL(file);
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

        const originalTrack = localStreamRef.current?.getVideoTracks()[0];
        const processedTrack = backgroundProcessorRef.current?.getStream().getVideoTracks()[0];
        const cameraTrack = (backgroundEffect === 'none' || !processedTrack) ? originalTrack : processedTrack;

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

        setLocalStream(backgroundEffect === 'none' ? localStreamRef.current : new MediaStream([cameraTrack, ...localStreamRef.current.getAudioTracks()]));

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

    if (isRejected) {
        const isSessionReplaced = rejectedReason === 'session-replaced';
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', textAlign: 'center', padding: '2rem' }}>
                <div style={{ background: isSessionReplaced ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '2.5rem', borderRadius: '32px', border: `1px solid ${isSessionReplaced ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                    <div style={{ marginBottom: '2rem', color: isSessionReplaced ? '#3b82f6' : '#ef4444' }}>
                        {isSessionReplaced ? <MonitorUp size={80} /> : <XCircle size={80} />}
                    </div>
                    <h2 style={{ fontSize: '2.25rem', fontWeight: '800', marginBottom: '1rem', color: '#fff' }}>
                        {isSessionReplaced ? 'Another Session Active' : 'Entry Denied'}
                    </h2>
                    <p style={{ color: '#9ca3af', marginBottom: '2.5rem', fontSize: '1.125rem', lineHeight: '1.6' }}>
                        {isSessionReplaced
                            ? "You've joined this meeting from another tab or device. To maintain security, only one connection is allowed at a time."
                            : "Your request to join this meeting was declined by the host."}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{ background: '#3b82f6', color: '#fff', padding: '1rem 2.5rem', borderRadius: '14px', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)' }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            {isSessionReplaced ? 'Reconnect This Tab' : 'Try Again'}
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            style={{ background: 'transparent', color: '#9ca3af', padding: '0.75rem', borderRadius: '14px', fontWeight: '600', border: '1px solid #374151', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isWaiting) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111827', color: '#fff', textAlign: 'center', padding: '2rem' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{ width: '120px', height: '120px', borderRadius: '50%', border: '4px solid #3b82f6', borderTopColor: 'transparent', animation: 'spin 1.5s linear infinite', marginBottom: '2rem' }}></div>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '-1rem' }}>
                        <Users size={40} color="#3b82f6" />
                    </div>
                </div>
                <h2 style={{ fontSize: '2.25rem', fontWeight: '800', marginBottom: '1rem', background: 'linear-gradient(to right, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Waiting for Approval</h2>
                <p style={{ color: '#9ca3af', fontSize: '1.125rem', maxWidth: '500px', lineHeight: '1.6' }}>
                    The meeting host has been notified. Please stay on this page while we wait for them to let you in.
                </p>
                <div style={{ marginTop: '3rem', padding: '1rem 2rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', animation: 'pulse 2s infinite' }}></div>
                    <span style={{ color: '#60a5fa', fontWeight: '500' }}>Securely connecting to room...</span>
                </div>
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
                `}</style>
            </div>
        );
    }

    const totalParticipants = peers.length + 1;
    let gridCols, gridRows;
    if (totalParticipants === 1) {
        gridCols = '1fr';
        gridRows = '1fr';
    } else {
        const nCols = Math.ceil(Math.sqrt(totalParticipants));
        const nRows = Math.ceil(totalParticipants / nCols);
        gridCols = `repeat(${nCols}, 1fr)`;
        gridRows = `repeat(${nRows}, minmax(0, 1fr))`;
    }

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
                    {myRole === 'admin' && joinRequests.length > 0 && (
                        <button
                            onClick={() => setShowJoinRequests(!showJoinRequests)}
                            style={{ position: 'relative', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '0.5rem 1rem', borderRadius: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                        >
                            <ShieldAlert size={16} />
                            {joinRequests.length} Requests
                            <span style={{ position: 'absolute', top: -5, right: -5, width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%', border: '2px solid #fff' }}></span>
                        </button>
                    )}
                </div>
            </header>

            {/* Admin Approval Sidebar/Modal */}
            {showJoinRequests && myRole === 'admin' && (
                <div style={{ position: 'fixed', top: '100px', right: '2.5rem', width: '320px', background: '#fff', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', border: '1px solid #e5e7eb', zIndex: 100, overflow: 'hidden', animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#111827' }}>Pending Requests</h3>
                        <button onClick={() => setShowJoinRequests(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
                    </div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0.75rem' }}>
                        {joinRequests.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No pending requests</div>
                        ) : (
                            joinRequests.map(request => (
                                <div key={request.userId} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '16px', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: '40px', height: '40px', background: '#3b82f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>{getInitials(request.username)}</div>
                                        <div style={{ fontWeight: '600', color: '#111827' }}>{request.username}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => approveUser(request.userId)} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <Check size={16} /> Approve
                                        </button>
                                        <button onClick={() => rejectUser(request.userId)} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <X size={16} /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

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
                        : `${peerNamesRef.current[activePresenterId] || 'Someone'}'s Presentation`}
                </div>
            )}

            {/* Video Main Area + Sidebar Container */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                    flex: 1,
                    display: 'flex',
                    background: '#f3f4f6',
                    overflow: 'hidden',
                    padding: activePresenterId ? '0' : '2rem',
                    position: 'relative',
                    transition: 'all 0.3s ease'
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
                                        isVideoDisabled={isVideoOff}
                                        isHandRaised={isHandRaised}
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
                                            isHandRaised={raisedHands[peer.id]}
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
                            gridTemplateRows: gridRows,
                            gap: '1rem',
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'hidden'
                        }}>
                            {/* Local Participant */}
                            <VideoTile
                                peerId="local"
                                stream={localStream}
                                username={localStorage.getItem('username') || 'You'}
                                isMuted={isMuted}
                                isVideoDisabled={isVideoOff}
                                isHandRaised={isHandRaised}
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
                                    isHandRaised={raisedHands[peer.id]}
                                    isLocal={false}
                                    isActiveSpeaker={activeSpeakerId === peer.id}
                                    totalParticipants={totalParticipants}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Participant List Side Panel */}
                <aside style={{
                    width: showParticipants ? '320px' : '0',
                    background: '#fff',
                    borderLeft: '1px solid #e5e7eb',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    boxShadow: showParticipants ? '-10px 0 25px rgba(0,0,0,0.05)' : 'none',
                    zIndex: 25,
                    transform: showParticipants ? 'translateX(0)' : 'translateX(100%)'
                }}>
                    <div style={{ minWidth: '320px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: '#111827' }}>Participants ({totalParticipants})</h2>
                            <button onClick={() => setShowParticipants(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                            {/* Local User Row */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', borderRadius: '12px',
                                background: '#f8fafc', marginBottom: '0.5rem', border: '1px solid #f1f5f9'
                            }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.85rem'
                                }}>
                                    {getInitials(localStorage.getItem('username'))}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {localStorage.getItem('username')} (You)
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Meeting Host</div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                    {isHandRaised && <Hand size={14} color="#fbbf24" fill="#fbbf24" />}
                                    {isScreenSharing && <MonitorUp size={14} color="#3b82f6" />}
                                    {isMuted ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} color="#10b981" />}
                                </div>
                            </div>

                            {/* Remote Peers Rows */}
                            {peers.map(peer => (
                                <div key={peer.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', borderRadius: '12px',
                                    marginBottom: '0.25rem', transition: 'background 0.2s'
                                }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.85rem'
                                    }}>
                                        {getInitials(participantNames[peer.id] || 'Guest')}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {participantNames[peer.id] || 'Guest'}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Participant</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                        {raisedHands[peer.id] && <Hand size={14} color="#fbbf24" fill="#fbbf24" />}
                                        {activePresenterId === peer.id && <MonitorUp size={14} color="#3b82f6" />}
                                        {mutedPeers[peer.id] ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} color="#10b981" />}

                                        {myRole === 'admin' && (
                                            <button
                                                onClick={() => handleRemoveParticipant(peer.id)}
                                                style={{
                                                    background: '#fee2e2',
                                                    border: 'none',
                                                    color: '#ef4444',
                                                    fontSize: '0.7rem',
                                                    fontWeight: '600',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    marginLeft: '4px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.background = '#fecaca'}
                                                onMouseLeave={(e) => e.target.style.background = '#fee2e2'}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Chat Side Panel */}
                <aside style={{
                    width: isChatOpen ? '320px' : '0',
                    background: '#fff',
                    borderLeft: '1px solid #e5e7eb',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    boxShadow: isChatOpen ? '-10px 0 25px rgba(0,0,0,0.05)' : 'none',
                    zIndex: 25,
                    transform: isChatOpen ? 'translateX(0)' : 'translateX(100%)'
                }}>
                    <div style={{ minWidth: '320px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: '#111827' }}>Meeting Chat</h2>
                            <button onClick={() => setIsChatOpen(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {chatMessages.map((msg, idx) => {
                                const isMe = msg.userId === myPeerId.current;
                                return (
                                    <div key={idx} style={{
                                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                                        maxWidth: '85%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: isMe ? 'flex-end' : 'flex-start'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.2rem', padding: '0 0.4rem' }}>
                                            {isMe ? 'You' : msg.username} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                            background: isMe ? '#3b82f6' : '#f1f5f9',
                                            color: isMe ? '#fff' : '#1e293b',
                                            fontSize: '0.875rem',
                                            lineHeight: '1.4',
                                            boxShadow: isMe ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none',
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {msg.message}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} style={{ padding: '1.25rem', borderTop: '1px solid #f3f4f6', background: '#fff' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <textarea
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={handleChatKeyDown}
                                    placeholder="Send a message..."
                                    rows="1"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 3.5rem 0.75rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        background: '#f8fafc',
                                        fontSize: '0.875rem',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        resize: 'none',
                                        minHeight: '42px',
                                        maxHeight: '120px',
                                        fontFamily: 'inherit'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                                <button
                                    type="submit"
                                    style={{
                                        position: 'absolute',
                                        right: '6px',
                                        bottom: '6px',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: chatInput.trim() ? '#3b82f6' : '#cbd5e1',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: chatInput.trim() ? 'pointer' : 'default',
                                        transition: 'all 0.2s'
                                    }}
                                    disabled={!chatInput.trim()}
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </form>
                    </div>
                </aside>
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

                {/* Show Participants Toggle */}
                <button
                    onClick={toggleParticipants}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: showParticipants ? '#10b981' : '#f1f5f9', color: showParticipants ? '#fff' : '#475569',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        outline: 'none',
                        position: 'relative'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; }}
                    title="Participant List"
                >
                    <Users size={24} />
                </button>

                {/* Show Chat Toggle */}
                <button
                    onClick={toggleChat}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isChatOpen ? '#10b981' : '#f1f5f9', color: isChatOpen ? '#fff' : '#475569',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        outline: 'none',
                        position: 'relative'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; }}
                    title="Meeting Chat"
                >
                    <MessageSquare size={24} />
                    {unreadCount > 0 && !isChatOpen && (
                        <div style={{
                            position: 'absolute', top: -2, right: -2, background: '#ef4444', color: '#fff',
                            width: '20px', height: '20px', borderRadius: '50%', fontSize: '0.7rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
                            fontWeight: 'bold', animation: 'bounce 0.5s infinite alternate'
                        }}>
                            {unreadCount}
                        </div>
                    )}
                </button>

                {/* Raise Hand Button */}
                <button
                    onClick={toggleHandRaise}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isHandRaised ? '#fbbf24' : '#f1f5f9', color: isHandRaised ? '#000' : '#475569',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        outline: 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; }}
                    title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
                >
                    <Hand size={24} fill={isHandRaised ? 'currentColor' : 'none'} />
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

                {/* Professional Background Selector */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowBgSettings(!showBgSettings)}
                        style={{
                            width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                            background: showBgSettings ? '#3b82f6' : '#f1f5f9', color: showBgSettings ? '#fff' : '#475569',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            outline: 'none',
                        }}
                        onMouseEnter={(e) => { if (!showBgSettings) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; } }}
                        onMouseLeave={(e) => { if (!showBgSettings) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'; } }}
                        title="Background Settings"
                    >
                        <ImageIcon size={24} />
                    </button>

                    {showBgSettings && (
                        <div style={{
                            position: 'absolute',
                            bottom: '80px',
                            right: '0',
                            width: '320px',
                            background: '#fff',
                            borderRadius: '20px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            border: '1px solid #e5e7eb',
                            padding: '1.5rem',
                            zIndex: 100,
                            animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#111827' }}>Background Effects</h3>
                                <button onClick={() => setShowBgSettings(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                                {/* None */}
                                <div
                                    onClick={() => handleBackgroundChange('none')}
                                    style={{
                                        cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${backgroundEffect === 'none' ? '#3b82f6' : '#f1f5f9'}`,
                                        position: 'relative', aspectRatio: '16/9', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = backgroundEffect === 'none' ? '#3b82f6' : '#cbd5e1'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = backgroundEffect === 'none' ? '#3b82f6' : '#f1f5f9'; }}
                                >
                                    <VideoOff size={24} color="#94a3b8" />
                                    {backgroundEffect === 'none' && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#3b82f6', borderRadius: '50%', padding: '2px', display: 'flex' }}><Check size={12} color="#fff" /></div>}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.9)', color: '#475569', fontSize: '10px', padding: '4px', textAlign: 'center', fontWeight: '500' }}>None</div>
                                </div>

                                {/* Blur */}
                                <div
                                    onClick={() => handleBackgroundChange('blur')}
                                    style={{
                                        cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${backgroundEffect === 'blur' ? '#3b82f6' : '#f1f5f9'}`,
                                        position: 'relative', aspectRatio: '16/9', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = backgroundEffect === 'blur' ? '#3b82f6' : '#cbd5e1'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = backgroundEffect === 'blur' ? '#3b82f6' : '#f1f5f9'; }}
                                >
                                    <div style={{ width: '100%', height: '100%', filter: 'blur(4px)', background: 'linear-gradient(45deg, #e2e8f0, #cbd5e1)' }}></div>
                                    <Circle size={24} color="#fff" style={{ position: 'absolute' }} />
                                    {backgroundEffect === 'blur' && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#3b82f6', borderRadius: '50%', padding: '2px', display: 'flex' }}><Check size={12} color="#fff" /></div>}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.9)', color: '#475569', fontSize: '10px', padding: '4px', textAlign: 'center', fontWeight: '500' }}>Blur</div>
                                </div>

                                {/* Library */}
                                <div
                                    onClick={() => handleBackgroundChange('library')}
                                    style={{
                                        cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${backgroundEffect === 'image' && bgImageUrl.includes('photo-1507842217343') ? '#3b82f6' : '#f1f5f9'}`,
                                        position: 'relative', aspectRatio: '16/9', transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = (backgroundEffect === 'image' && bgImageUrl.includes('photo-1507842217343')) ? '#3b82f6' : '#cbd5e1'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = (backgroundEffect === 'image' && bgImageUrl.includes('photo-1507842217343')) ? '#3b82f6' : '#f1f5f9'; }}
                                >
                                    <img src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=200&q=60" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Library" />
                                    {(backgroundEffect === 'image' && bgImageUrl.includes('photo-1507842217343')) && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#3b82f6', borderRadius: '50%', padding: '2px', display: 'flex' }}><Check size={12} color="#fff" /></div>}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.9)', color: '#475569', fontSize: '10px', padding: '4px', textAlign: 'center', fontWeight: '500' }}>Library</div>
                                </div>

                                {/* Office */}
                                <div
                                    onClick={() => handleBackgroundChange('office')}
                                    style={{
                                        cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${backgroundEffect === 'image' && bgImageUrl.includes('photo-1497366216548') ? '#3b82f6' : '#f1f5f9'}`,
                                        position: 'relative', aspectRatio: '16/9', transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = (backgroundEffect === 'image' && bgImageUrl.includes('photo-1497366216548')) ? '#3b82f6' : '#cbd5e1'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = (backgroundEffect === 'image' && bgImageUrl.includes('photo-1497366216548')) ? '#3b82f6' : '#f1f5f9'; }}
                                >
                                    <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=200&q=60" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Office" />
                                    {(backgroundEffect === 'image' && bgImageUrl.includes('photo-1497366216548')) && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#3b82f6', borderRadius: '50%', padding: '2px', display: 'flex' }}><Check size={12} color="#fff" /></div>}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.9)', color: '#475569', fontSize: '10px', padding: '4px', textAlign: 'center', fontWeight: '500' }}>Office</div>
                                </div>

                                {/* Custom Upload Tile */}
                                <label style={{
                                    cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${backgroundEffect === 'custom' ? '#3b82f6' : '#f1f5f9'}`,
                                    position: 'relative', aspectRatio: '16/9', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                    transition: 'all 0.2s ease'
                                }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = backgroundEffect === 'custom' ? '#3b82f6' : '#cbd5e1'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = backgroundEffect === 'custom' ? '#3b82f6' : '#f1f5f9'; }}
                                >
                                    <Upload size={20} color="#64748b" />
                                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>Custom</span>
                                    <input type="file" accept="image/*" onChange={handleCustomBackgroundUpload} style={{ display: 'none' }} />
                                    {backgroundEffect === 'custom' && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#3b82f6', borderRadius: '50%', padding: '2px', display: 'flex' }}><Check size={12} color="#fff" /></div>}
                                </label>
                            </div>
                        </div>
                    )}
                </div>



            </footer>


            {/* Notification Toast */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: '2rem',
                    right: '2rem',
                    background: '#1f2937',
                    color: '#fff',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    zIndex: 100,
                    animation: 'slideIn 0.3s ease-out',
                    border: '1px solid #374151'
                }}>
                    <div style={{ background: '#fbbf24', padding: '6px', borderRadius: '50%', color: '#000' }}>
                        <Hand size={16} fill="currentColor" />
                    </div>
                    <span>{toast.message}</span>
                </div>
            )}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                @keyframes popIn {
                    from { transform: scale(0.9) translateY(20px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }

                @keyframes bounce {
                    from { transform: translateY(0); }
                    to { transform: translateY(-3px); }
                }

                .active-speaker {
                    box-shadow: 0 0 0 4px #10b981 !important;
                    border-color: #10b981 !important;
                }
            `}</style>

        </div>
    );
};

export default MeetingRoom;
