'use client';

import { createTheme, responsiveFontSizes } from '@mui/material/styles';

/**
 * The Material UI theme: colours, shape and the defaults every component starts from. Heading
 * sizes scale down on narrow screens, so a page title fits a phone without breaking awkwardly.
 */
export const theme = responsiveFontSizes(
  createTheme({
    cssVariables: true,
    palette: {
      primary: { main: '#2563eb' },
      background: { default: '#fafafa' },
    },
    shape: { borderRadius: 8 },
  }),
);
