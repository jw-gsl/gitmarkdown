'use client';

import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface ResponsiveSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  children: React.ReactNode;
  title?: string;
}

export function ResponsiveSidebar({
  isOpen,
  onClose,
  side,
  children,
  title = 'Sidebar',
}: ResponsiveSidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side={side} showCloseButton={false} className="p-0 w-full sm:max-w-sm">
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title} panel</SheetDescription>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  if (!isOpen) return null;

  return <>{children}</>;
}
