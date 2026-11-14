'use client';

import { useState } from 'react';
import { Box, Typography } from '@/components/ui';

interface RestaurantImageProps {
  src: string;
  height: number | Record<string, number>;
  /** Empty when a nearby heading already names the restaurant. */
  alt?: string;
}

/**
 * A restaurant's preview image. If it cannot be loaded (removed from storage, CDN down), a
 * neutral placeholder of the same size takes its place instead of a broken-image icon.
 */
export default function RestaurantImage({ src, height, alt = '' }: RestaurantImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <Box
        role="img"
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Image unavailable
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      // A server-rendered image can fail before React attaches onError; catch that on mount.
      ref={(img: HTMLImageElement | null) => {
        if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
      }}
      sx={{ height, width: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}
