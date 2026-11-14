import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

interface FormCardProps {
  title: string;
  children: ReactNode;
  /** Shown under the card, for example a link to the alternative form. */
  footer?: ReactNode;
}

/** The framed, centred panel that every standalone form sits in. */
export default function FormCard({ title, children, footer }: FormCardProps) {
  return (
    <Stack spacing={3} sx={{ maxWidth: 480, mx: 'auto', py: 4 }}>
      <Typography variant="h4" component="h1" align="center">
        {title}
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 } }}>
        {children}
      </Paper>
      {footer && (
        <Typography variant="body2" color="text.secondary" align="center">
          {footer}
        </Typography>
      )}
    </Stack>
  );
}
