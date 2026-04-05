/**
 * @file socket.ts
 * @description Singleton Socket.IO client instance for the ThirdEye client.
 *              Exported as a single object — import this wherever socket
 *              events need to be emitted or listened to.
 *              autoConnect: false — connection is initiated explicitly in useSocket.
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

/**
 * @description The global Socket.IO client instance.
 *              autoConnect is false so the connection is managed manually
 *              (connected on room join, disconnected on room leave).
 */
const socket: Socket = io(SOCKET_URL, {
  autoConnect:   false,
  withCredentials: true,
  transports:    ['websocket', 'polling'],
});

export default socket;
