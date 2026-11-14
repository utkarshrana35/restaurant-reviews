'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  /** The label of the button that goes ahead, for example "Delete". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** True while the confirmed action is running; both buttons are held until it finishes. */
  busy?: boolean;
  /** Shown inside the dialog when the confirmed action failed, so the user can retry. */
  error?: string | null;
}

/** Asks the user to confirm an action that cannot be undone. */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  error,
}: ConfirmDialogProps) {
  return (
    // Closing by Escape or a click outside counts as Cancel, but not while the action is running.
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{children}</DialogContentText>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" loading={busy}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
