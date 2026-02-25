import uuid
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # rooms = { room_id: { peer_id: WebSocket } }
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        
        # Assign a unique peer ID to this connection
        peer_id = str(uuid.uuid4())
        
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        
        self.rooms[room_id][peer_id] = websocket
        
        # Send the assigned peer ID back to the user
        await websocket.send_json({
            "type": "init",
            "peer_id": peer_id
        })
        
        # Notify others in the room about the new participant
        await self.broadcast(room_id, {
            "type": "join",
            "sender_id": peer_id,
            "message": "A new user has joined the room"
        }, sender_id=peer_id)
        
        return peer_id

    def disconnect(self, room_id: str, peer_id: str):
        if room_id in self.rooms and peer_id in self.rooms[room_id]:
            del self.rooms[room_id][peer_id]
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def send_to_target(self, room_id: str, target_id: str, message: dict):
        if room_id in self.rooms and target_id in self.rooms[room_id]:
            try:
                await self.rooms[room_id][target_id].send_json(message)
            except Exception:
                pass

    async def broadcast(self, room_id: str, message: dict, sender_id: str = None):
        if room_id in self.rooms:
            for peer_id, connection in self.rooms[room_id].items():
                if peer_id != sender_id:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass

manager = ConnectionManager()
