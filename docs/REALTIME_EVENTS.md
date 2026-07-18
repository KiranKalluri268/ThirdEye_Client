# ThirdEye Real-time Events

ThirdEye uses the default Socket.IO namespace on the same origin as the REST server. In development, Vite proxies `/socket.io` to port `5000`. Event names and payload keys are part of the client/server contract and must be updated in both repositories together.

## Connection lifecycle

The client creates one shared Socket.IO connection with credentials enabled. A classroom then emits `join`. The server stores the room code on the socket for disconnect cleanup.

Unless noted otherwise, the server does not acknowledge events with callbacks. Errors from chat handling can arrive through the generic `error` event.

## Client-to-server events

| Event | Payload | Purpose |
| --- | --- | --- |
| `join` | `{ roomCode, userId, displayName }` | Join a Socket.IO room, receive existing peers and permissions, notify others, and auto-enroll a non-instructor. |
| `offer` | `{ to, sdp }` | Relay a WebRTC SDP offer to a target socket. |
| `answer` | `{ to, sdp }` | Relay a WebRTC SDP answer to a target socket. |
| `ice-candidate` | `{ to, candidate }` | Relay an ICE candidate to a target socket. |
| `mute` | `{ roomCode, kind }` | Set local participant state and broadcast it. `kind` is `audio` or `video`. |
| `unmute` | `{ roomCode, kind }` | Clear the corresponding muted/camera-off state and broadcast it. |
| `hand-raised` | `{ roomCode }` | Mark and broadcast a raised hand. |
| `hand-lowered` | `{ roomCode }` | Clear and broadcast a raised hand. |
| `set-screen-stream` | `{ roomCode, screenStreamId }` | Announce the sender's screen MediaStream ID. |
| `engagement-update` | `{ roomCode, engagementLevel }` | Broadcast a student's latest derived engagement label without persisting it. |
| `send-message` | `{ roomCode, senderId, senderName, content }` | Validate non-empty content, persist the chat message, and broadcast it. |
| `set-permissions` | `{ roomCode, allowUnmute, allowCamToggle }` | Replace room-wide instructor media permissions. |
| `force-mute-all` | `{ roomCode, kind }` | Tell every other participant to disable audio or video. |
| `force-mute-peer` | `{ roomCode, targetSocketId, kind }` | Tell one socket to disable audio or video. |
| `force-unmute-all` | `{ roomCode, kind }` | Tell every other participant to enable audio or video. |
| `force-unmute-peer` | `{ roomCode, targetSocketId, kind }` | Tell one socket to enable audio or video. |
| `end-session` | `{ roomCode }` | Notify the room that the session ended and clear in-memory room state. Durable session completion is a separate REST call. |
| `leave` | `{ roomCode }` | Explicitly leave; server cleanup uses the room stored during `join`. |

Valid engagement levels are `very_low`, `low`, `high`, and `very_high`.

## Server-to-client events

| Event | Payload | Recipients / purpose |
| --- | --- | --- |
| `peers` | `{ peers: PeerInfo[] }` | Joining socket only; snapshot of participants already in the room. |
| `permissions-updated` | `{ allowUnmute, allowCamToggle }` | Joining socket and, after updates, every socket in the room. |
| `peer-joined` | `PeerInfo` | Existing room members; add the new participant. |
| `offer` | `{ from, sdp, displayName }` | Target socket; create/set remote description and answer. |
| `answer` | `{ from, sdp }` | Target socket; complete SDP negotiation. |
| `ice-candidate` | `{ from, candidate }` | Target socket; add the remote ICE candidate. |
| `peer-muted` | `{ socketId, kind }` | Other room members; update participant media state. |
| `peer-unmuted` | `{ socketId, kind }` | Other room members; update participant media state. |
| `peer-hand-raised` | `{ socketId }` | Other room members; show raised-hand state. |
| `peer-hand-lowered` | `{ socketId }` | Other room members; clear raised-hand state. |
| `set-screen-stream` | `{ socketId, screenStreamId }` | Other room members; associate incoming screen media with a peer. |
| `peer-engagement` | `{ socketId, engagementLevel }` | Other room members, primarily the instructor dashboard. |
| `message` | `{ _id, senderId, senderName, content, timestamp }` | Every socket in the room, including the sender. |
| `instructor-force-mute` | `{ kind }` | Selected peer(s); disable the requested local track. |
| `instructor-force-unmute` | `{ kind }` | Selected peer(s); enable the requested local track. |
| `session-ended` | no payload | Every socket in the room; leave the classroom UI. |
| `peer-left` | `{ socketId }` | Remaining room members after explicit leave or disconnect. |
| `error` | `{ message }` | Originating socket when chat room lookup or persistence fails. |

`PeerInfo` has this shape:

```ts
interface PeerInfo {
  socketId: string;
  userId: string;
  displayName: string;
  isMuted: boolean;
  isCamOff: boolean;
  isHandRaised: boolean;
}
```

## Important behavior

- `socket.to(roomCode)` excludes the sender; `io.to(roomCode)` includes it.
- Calling both `leave` and disconnect cleanup is safe because deleting the same socket twice is harmless, though peers may receive duplicate `peer-left` events in some flows.
- `end-session` only clears live state. The instructor client first calls `PATCH /api/sessions/:id/end` to update MongoDB.
- Chat history is not a socket event. Clients load the latest 50 messages through `GET /api/rooms/:roomCode/chat-history` before listening for `message`.
- Engagement persistence is not a socket event. The client uses `POST /api/rooms/:roomCode/save-record`; `engagement-update` is only the low-latency live signal.
- Room membership and permissions live in server memory and disappear on restart.

## Security boundary

The current socket server accepts identity, room, and instructor-control claims from event payloads. It does not verify a JWT during the Socket.IO handshake. Before exposing the service to untrusted users, authenticate connections, bind verified user/role/room state to `socket.data`, validate payloads, and authorize every instructor event server-side.

