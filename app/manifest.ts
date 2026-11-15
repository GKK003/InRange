import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'InRange — your daily co-pilot',
    short_name: 'InRange',
    description: 'A calmer view of glucose, food, and daily context.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f8f5',
    theme_color: '#1f382e',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }],
  };
}

