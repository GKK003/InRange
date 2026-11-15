import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'InRange — your daily co-pilot', description: 'A calmer view of glucose, food, and daily context.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
