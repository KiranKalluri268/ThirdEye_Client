import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import api from '../api/api';
import { useToast } from '../context/ToastContext';

interface CreateSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateSessionModal: React.FC<CreateSessionModalProps> = ({ open, onClose, onSuccess }) => {
  const { push } = useToast();
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDuration, setNewDuration] = useState(60);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (): Promise<void> => {
    if (!newTitle || !newDate) {
      push('Please fill in title and start time.', 'warning');
      return;
    }
    setCreating(true);
    try {
      await api.post('/sessions', {
        title: newTitle,
        description: newDesc,
        startTime: newDate,
        durationMinutes: newDuration,
      });
      setNewTitle('');
      setNewDesc('');
      setNewDate('');
      setNewDuration(60);
      push('Session created successfully!', 'success');
      onSuccess();
      onClose();
    } catch {
      push('Failed to create session.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
        },
      }}
    >
      <DialogTitle sx={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
        New Session
      </DialogTitle>
      <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          fullWidth
          sx={inputSx}
        />
        <TextField
          label="Description"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          fullWidth
          multiline
          rows={2}
          sx={inputSx}
        />
        <TextField
          label="Start Time"
          type="datetime-local"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
          sx={inputSx}
        />
        <TextField
          label="Duration (minutes)"
          type="number"
          value={newDuration}
          onChange={(e) => setNewDuration(Number(e.target.value))}
          fullWidth
          sx={inputSx}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'var(--text-secondary)' }}>
          Cancel
        </Button>
        <Button
          id="create-session-submit-btn"
          onClick={handleCreate}
          variant="contained"
          disabled={creating}
          sx={{
            background: 'var(--accent)',
            borderRadius: '10px',
            fontWeight: 700,
            '&:hover': { background: 'var(--accent-dark)' },
          }}
        >
          {creating ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const inputSx = {
  '& .MuiInputLabel-root': { color: 'var(--text-secondary)', fontFamily: 'inherit' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'var(--accent)' },
  '& .MuiOutlinedInput-root': {
    color: 'var(--text-primary)',
    background: 'var(--bg-elevated)',
    borderRadius: '10px',
    '& fieldset': { borderColor: 'var(--border)' },
    '&:hover fieldset': { borderColor: 'var(--accent)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)' },
  },
};

export default CreateSessionModal;
