import { Box, PageContainer, Typography } from '@/components/ui';

/** The footer on every page. */
export default function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor: 'grey.900', color: 'common.white', py: 4 }}>
      <PageContainer>
        <Typography variant="body2">Acme Restaurant Reviews</Typography>
      </PageContainer>
    </Box>
  );
}
