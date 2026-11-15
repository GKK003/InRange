import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{js,ts,jsx,tsx}'], theme: { extend: { colors: { ink: '#172522', sage: '#638b78', mint: '#e5f1e9', canvas: '#f6f8f5' }, boxShadow: { soft: '0 12px 34px rgba(37,65,53,.07)' } } }, plugins: [] } satisfies Config;
