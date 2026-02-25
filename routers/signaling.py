from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from signaling import manager

router = APIRouter(
    prefix="/ws",
    tags=["signaling"]
)

@router.websocket("/{room_id}")
async def websocket_signaling(websocket: WebSocket, room_id: str):
    peer_id = await manager.connect(room_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Attach the sender's ID to the message
            data["sender_id"] = peer_id
            
            # If the message has a specific target, send it only there
            target_id = data.get("target_id")
            if target_id:
                await manager.send_to_target(room_id, target_id, data)
            else:
                # Otherwise broadcast to everyone else
                await manager.broadcast(room_id, data, sender_id=peer_id)
            
    except WebSocketDisconnect:
        manager.disconnect(room_id, peer_id)
        await manager.broadcast(room_id, {
            "type": "leave",
            "sender_id": peer_id,
            "message": "A user has left the room"
        })
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(room_id, peer_id)
