import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Footer from '@/components/Footer';
import NavBar from '@/components/NavBar';
import { Box, PageContainer } from '@/components/ui';
import Providers from './providers';

export const metadata: Metadata = {
  title: { default: 'Restaurant Reviews', template: '%s | Restaurant Reviews' },
  description: 'Find restaurants and read what other diners thought of them.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <Providers>
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <NavBar />
              {/* Every page gets the same frame: main landmark, vertical spacing, page width. */}
              <Box component="main" sx={{ flexGrow: 1, py: 4 }}>
                <PageContainer>{children}</PageContainer>
              </Box>
              <Footer />
            </Box>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
