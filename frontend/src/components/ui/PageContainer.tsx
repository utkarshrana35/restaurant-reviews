import Container from '@mui/material/Container';
import type { ReactNode } from 'react';

/**
 * Centres content at the app's standard width. The root layout wraps every page in one, so pages
 * do not add their own; the nav bar and footer use it to line up with the page content.
 */
export default function PageContainer({ children }: { children: ReactNode }) {
  return <Container maxWidth="lg">{children}</Container>;
}
