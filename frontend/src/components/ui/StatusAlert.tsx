'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import type { ReactNode } from 'react';

interface StatusAlertProps {
  severity: 'success' | 'info' | 'error';
  children: ReactNode;
  /** When given, the alert shows a Retry button. */
  onRetry?: () => void;
  retrying?: boolean;
}

/** An inline status message, optionally with a retry action. */
export default function StatusAlert({ severity, children, onRetry, retrying }: StatusAlertProps) {
  return (
    <Alert
      severity={severity}
      action={
        onRetry && (
          <Button color="inherit" size="small" disabled={retrying} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {children}
    </Alert>
  );
}
