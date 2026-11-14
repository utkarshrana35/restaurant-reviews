'use client';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import StoreProvider from '@/store/StoreProvider';
import { theme } from '@/theme';

/** Everything the whole app runs inside: the theme and the Redux store. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StoreProvider>{children}</StoreProvider>
    </ThemeProvider>
  );
}
