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
            
            # Special handling for "join" to update username and sync state
            if data.get("type") == "join":
                username = data.get("username", "Guest")
                manager.update_username(room_id, peer_id, username)
                
                # Broadcast the updated participant list and active presenter to everyone in the room
                users, presenter = manager.get_participants(room_id)
                await manager.broadcast(room_id, {
                    "type": "participants",
                    "users": users,
                    "presenter": presenter
                })

                # Also broadcast the "join" message so existing participants know to initiate a call
                await manager.broadcast(room_id, {
                    "type": "join",
                    "sender_id": peer_id,
                    "username": username
                }, sender_id=peer_id)
                continue
            # Special handling for "screen-share" to track the presenter
            if data.get("type") == "screen-share":
                if data.get("isSharing"):
                    manager.set_presenter(room_id, peer_id)
                else:
                    users, presenter = manager.get_participants(room_id)
                    if presenter == peer_id:
                        manager.set_presenter(room_id, None)
                continue

            # Special handling for "chat-message" to broadcast to room (including sender)
            elif data.get("type") == "chat-message":
                await manager.broadcast(room_id, data)
                continue

            # Special handling for "mic-status", "video-status", "raise-hand"
            # These are now handled by the default broadcast logic below, 
            # so we don't need separate blocks that cause duplication.

            # If the bit is for a specific target, send it only there
            target_id = data.get("target_id")
            if target_id:
                await manager.send_to_target(room_id, target_id, data)
            else:
                # Otherwise broadcast to everyone else (default behavior)
                await manager.broadcast(room_id, data, sender_id=peer_id)
            
    except WebSocketDisconnect:
        manager.disconnect(room_id, peer_id)
        # Broadcast the updated participant list after someone leaves
        users, presenter = manager.get_participants(room_id)
        await manager.broadcast(room_id, {
            "type": "participants",
            "users": users,
            "presenter": presenter
        })
        await manager.broadcast(room_id, {
            "type": "leave",
            "sender_id": peer_id,
            "message": f"User {peer_id} has left the room"
        })
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(room_id, peer_id)
