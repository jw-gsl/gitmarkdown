'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  filename: string;
}

export function ImageViewer({ src, filename }: ImageViewerProps) {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState(false);

  const basename = filename.split('/').pop() || filename;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <ImageOff className="h-10 w-10" />
        <p className="text-sm">Failed to load image</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={basename}
        className="max-h-[70vh] max-w-full rounded-md border object-contain"
        onLoad={(e) => {
          const img = e.currentTarget;
          setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        onError={() => setError(true)}
      />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium">{basename}</span>
        {dimensions && (
          <span>
            {dimensions.w} &times; {dimensions.h}
          </span>
        )}
      </div>
    </div>
  );
}
