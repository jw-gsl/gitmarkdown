import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

export function LogoMark({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-5 w-5', className)}
    >
      <rect x="3" y="1" width="18" height="22" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.06"/>
      <path d="M7 16V8l3.5 4L14 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="18" cy="12" r="1.3" fill="currentColor"/>
      <path d="M14 12h2.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
