import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Shown on the right, for example the button that starts the page's main action. */
  action?: ReactNode;
}

/** The heading at the top of a page, with room for one action beside it. */
export default function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <Stack
      direction="row"
      spacing={2}
      // A real gap rather than margins, so the action lines up when it wraps below the title.
      useFlexGap
      sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 3 }}
    >
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      {action}
    </Stack>
  );
}
