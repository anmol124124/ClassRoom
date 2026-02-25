import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for screen recording functionality.
 */
const useScreenRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordingStream, setRecordingStream] = useState(null);
    const mediaRecorderRef = useRef(null);
    const timerRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = useCallback(async (existingStream = null) => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

        try {
            let stream = existingStream;
            let isExternalStream = !!existingStream;

            if (!stream) {
                // Request screen recording stream only if no existing stream provided
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: "always",
                        frameRate: 15
                    },
                    audio: true // Capture system audio
                });
            }

            setRecordingStream(stream);

            // Handle when user stops sharing via browser UI
            stream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm; codecs=vp8',
                videoBitsPerSecond: 1200000
            });

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm; codecs=vp8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `meeting-recording-${new Date().toISOString()}.webm`;
                document.body.appendChild(a);
                a.click();

                // Cleanup
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                // Stop all tracks to ensure cleanup (even if external, since sharing UI is already gone or ended)
                stream.getTracks().forEach(track => track.stop());

                setRecordingStream(null);
                setIsRecording(false);
                clearInterval(timerRef.current);
                setRecordingTime(0);
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Error starting recording:', err);
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return {
        isRecording,
        recordingTime,
        recordingStream,
        formatTime,
        startRecording,
        stopRecording
    };
};

export default useScreenRecorder;
