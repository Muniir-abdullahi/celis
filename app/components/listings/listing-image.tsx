"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { getOptimizedImageUrl } from "~/lib/images";

type ImageOptions = { width?: number; height?: number; quality?: number };

interface ListingImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
  imageOptions?: ImageOptions;
}

/** Falls back to the stored public URL if Supabase image rendering is unavailable. */
export function ListingImage({ src, imageOptions, onError, ...props }: ListingImageProps) {
  const optimizedSrc = getOptimizedImageUrl(src, imageOptions);
  const [fallbackFor, setFallbackFor] = useState<string | null>(null);
  const useOriginal = fallbackFor === optimizedSrc;

  return (
    <img
      {...props}
      src={useOriginal ? src : optimizedSrc}
      onError={(event) => {
        if (!useOriginal && optimizedSrc !== src) {
          setFallbackFor(optimizedSrc);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
