# Course-Era: Professional WebRTC Meeting & Course Management System

Course-Era is a modern, full-stack video conferencing and course management platform. It features custom WebRTC meeting rooms, multi-participant video chat, and a built-in screen recording system.

## 🚀 Features

- **Custom WebRTC Meetings**: High-quality, low-latency video and audio.
- **Screen Recording**: Capture meetings (with system audio) directly in the browser and download as `.webm`.
- **Role-Based Access Control**:
  - **Admin**: Full control over courses and meeting scheduling.
  - **Tutor**: Manage course content and join meetings.
  - **Student**: View courses and attend live meetings.
- **Dynamic Video Grid**: Automatically adjusts layout based on the number of participants.
- **Signaling System**: Fast and reliable peer discovery via WebSockets.
- **CORS Support**: Ready for external access via ngrok or production deployment.

## 🛠️ Tech Stack

**Frontend:**
- React (Vite)
- WebRTC API
- MediaRecorder API (for screen recording)
- Axios for API communication

**Backend:**
- FastAPI (Python)
- SQLAlchemy (ORM)
- SQLite (Portable Database)
- Uvicorn (ASGI Server)
- WebSockets for Signaling

## 🛠️ Installation & Setup

### 1. Prerequisites
- Python 3.8+
- Node.js & npm

### 2. Backend Setup
1. Clone the repository and navigate to the project root.
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend:
   ```bash
   python main.py
   ```

### 3. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. If running in development mode:
   ```bash
   npm run dev
   ```
4. For production (recommended for ngrok):
   ```bash
   npm run build
   ```

## 🌐 External Access (ngrok)

To host meetings that others can join from outside your local network:

1. **Configure Envs**: Update `frontend/.env` with your ngrok URL:
   ```env
   VITE_API_URL=https://your-id.ngrok-free.dev
   VITE_WS_URL=wss://your-id.ngrok-free.dev
   ```
2. **Build Frontend**:
   ```bash
   cd frontend && npm run build
   ```
3. **Start Backend**:
   ```bash
   python main.py
   ```
4. **Start ngrok**:
   ```bash
   ngrok http 8000
   ```

## 🔐 Credentials (Demo Accounts)
- **Admin**: `admin@gmail.com` / `adminpassword`
- **Tutor**: `tutor@gmail.com` / `tutorpassword`
- **Student**: `student@gmail.com` / `studentpassword`

---

Built with ❤️ using FastAPI and React.
