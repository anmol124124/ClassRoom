import uuid
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # rooms = { room_id: { "peers": { peer_id: { "socket": WebSocket, "username": str } }, "presenter": str } }
        self.rooms: Dict[str, dict] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        
        # Assign a unique peer ID to this connection
        peer_id = str(uuid.uuid4())
        
        if room_id not in self.rooms:
            self.rooms[room_id] = {"peers": {}, "presenter": None}
        
        # Initial storage with default Guest name
        self.rooms[room_id]["peers"][peer_id] = {
            "socket": websocket,
            "username": "Guest"
        }
        
        # Send the assigned peer ID back to the user
        await websocket.send_json({
            "type": "init",
            "peer_id": peer_id
        })
        
        return peer_id

    def update_username(self, room_id: str, peer_id: str, username: str):
        if room_id in self.rooms and peer_id in self.rooms[room_id]["peers"]:
            self.rooms[room_id]["peers"][peer_id]["username"] = username

    def get_participants(self, room_id: str):
        if room_id in self.rooms:
            participants = [
                {"userId": pid, "username": info["username"]}
                for pid, info in self.rooms[room_id]["peers"].items()
            ]
            return participants, self.rooms[room_id].get("presenter")
        return [], None

    def set_presenter(self, room_id: str, peer_id: str):
        if room_id in self.rooms:
            self.rooms[room_id]["presenter"] = peer_id

    def disconnect(self, room_id: str, peer_id: str):
        if room_id in self.rooms and peer_id in self.rooms[room_id]["peers"]:
            del self.rooms[room_id]["peers"][peer_id]
            if self.rooms[room_id]["presenter"] == peer_id:
                self.rooms[room_id]["presenter"] = None
            if not self.rooms[room_id]["peers"]:
                del self.rooms[room_id]

    async def send_to_target(self, room_id: str, target_id: str, message: dict):
        if room_id in self.rooms and target_id in self.rooms[room_id]["peers"]:
            try:
                await self.rooms[room_id]["peers"][target_id]["socket"].send_json(message)
            except Exception:
                pass

    async def broadcast(self, room_id: str, message: dict, sender_id: str = None):
        if room_id in self.rooms:
            for peer_id, info in self.rooms[room_id]["peers"].items():
                if peer_id != sender_id:
                    try:
                        await info["socket"].send_json(message)
                    except Exception:
                        pass

manager = ConnectionManager()
