/**
 * @file ChatPanel.tsx
 * @description Slide-in chat sidebar for the classroom. Displays message history,
 *              handles sending new messages via Socket.IO, and auto-scrolls
 *              to the latest message on each new entry.
 */

import React, { useState, useEffect, useRef } from 'react';
import { IconButton, TextField } from '@mui/material';
import SendIcon  from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import socket    from '../../socket/socket';
import api       from '../../api/api';
import type { IChatMessage } from '../../types';

interface ChatPanelProps {
  roomCode:   string;
  userId:     string;
  userName:   string;
  onClose:    () => void;
}

/**
 * @description Formats a timestamp string into a human-readable HH:MM format.
 * @param ts - ISO timestamp string
 * @returns {string} e.g. "14:35"
 */
const formatTime = (ts: string): string =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * @description In-session chat panel. Loads history on mount, listens for
 *              new messages via Socket.IO, and sends messages through the socket.
 * @param roomCode - Room identifier for the socket event
 * @param userId   - Current user's MongoDB ID
 * @param userName - Current user's display name
 * @param onClose  - Callback to close the panel
 */
const ChatPanel: React.FC<ChatPanelProps> = ({ roomCode, userId, userName, onClose }) => {
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [input,    setInput]    = useState('');
  const bottomRef               = useRef<HTMLDivElement>(null);

  /** Load chat history on mount */
  useEffect(() => {
    api.get<{ success: boolean; messages: IChatMessage[] }>(`/rooms/${roomCode}/chat-history`)
      .then((res) => setMessages(res.data.messages))
      .catch(console.error);
  }, [roomCode]);

  /** Listen for new messages */
  useEffect(() => {
    const handleMessage = (msg: IChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on('message', handleMessage);
    return () => { socket.off('message', handleMessage); };
  }, []);

  /** Auto-scroll to bottom when messages change */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * @description Emits the typed message via Socket.IO and clears the input.
   */
  const sendMessage = (): void => {
    if (!input.trim()) return;
    socket.emit('send-message', { roomCode, senderId: userId, senderName: userName, content: input.trim() });
    setInput('');
  };

  /**
   * @description Handles Enter key press to send message (Shift+Enter = newline).
   */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="flex flex-col h-full slide-in-right"
      style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', width: 320 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>In-call messages</span>
        <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-secondary)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3" style={{ padding: '12px 16px' }}>
        {messages.length === 0 && (
          <p className="text-center text-sm" style={{ marginTop: '2rem', color: 'var(--text-muted)' }}>
            No messages yet — say hello 👋
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.senderId === userId;
          return (
            <div key={msg._id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              {!isOwn && (
                <span className="text-xs mb-1 font-medium" style={{ color: 'var(--accent-light)' }}>
                  {msg.senderName}
                </span>
              )}
              <div
                className="rounded-2xl text-sm max-w-[85%] break-words"
                style={{
                  padding:      '8px 12px',
                  background:   isOwn ? 'var(--accent)' : 'var(--bg-elevated)',
                  color:        'var(--text-primary)',
                  borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                }}
              >
                {msg.content}
              </div>
              <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <TextField
            fullWidth
            size="small"
            placeholder="Send a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            multiline
            maxRows={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                background:   'var(--bg-elevated)',
                borderRadius: '12px',
                color:        'var(--text-primary)',
                fontSize:     '0.875rem',
                '& fieldset': { borderColor: 'var(--border)' },
                '&:hover fieldset': { borderColor: 'var(--accent)' },
                '&.Mui-focused fieldset': { borderColor: 'var(--accent)' },
              },
            }}
          />
          <IconButton
            onClick={sendMessage}
            disabled={!input.trim()}
            sx={{
              background: 'var(--accent)',
              color:      '#fff',
              '&:hover':  { background: 'var(--accent-dark)' },
              '&:disabled': { opacity: 0.4 },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
