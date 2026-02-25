# Course-Era: Multi-Participant WebRTC Meeting System

A robust video conferencing platform built with FastAPI and React.

## ngrok Setup (External Access)

To allow users from different networks to join your meetings, follow these steps:

### 1. Run Backend
Start the signaling and API server on all interfaces:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Run Frontend
Start the React development server:
```bash
npm run dev -- --host
```

### 3. Start Single ngrok Tunnel
Since the backend now serves the frontend, you only need **one** tunnel:
```bash
ngrok http 8000
```

### 4. Configure Environment Variables

**Backend (`.env`) & Frontend (`frontend/.env`):**
Use the SAME ngrok URL for both:
```env
# Frontend .env
VITE_API_URL=https://your-ngrok-id.ngrok-free.dev
VITE_WS_URL=wss://your-ngrok-id.ngrok-free.dev

# Backend .env
FRONTEND_URL=https://your-ngrok-id.ngrok-free.dev
```

---

## Technical Features
- **Mesh-Network Architecture**: Scalable multi-participant support.
- **ID-Based Signaling**: Efficient peer-to-peer handshakes.
- **Dynamic Video Grid**: Responsive UI for 1 to N participants.
- **Robust Cleanup**: Automatic resource management on disconnect.
