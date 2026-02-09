'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CollaboratorPresence } from '@/types';

interface ActiveUsersProps {
  collaborators: CollaboratorPresence[];
  maxVisible?: number;
}

export function ActiveUsers({ collaborators, maxVisible = 5 }: ActiveUsersProps) {
  const visible = collaborators.slice(0, maxVisible);
  const overflow = collaborators.length - maxVisible;

  if (collaborators.length === 0) return null;

  return (
    <TooltipProvider>
      <div data-testid="active-users" aria-label={`${collaborators.length} active collaborator${collaborators.length !== 1 ? 's' : ''}`} className="flex items-center -space-x-2">
        {visible.map((user) => (
          <Tooltip key={user.uid}>
            <TooltipTrigger asChild>
              <Avatar
                className="h-7 w-7 border-2 border-background"
                style={{ borderColor: user.color }}
              >
                <AvatarImage src={user.photoURL || ''} alt={user.displayName} />
                <AvatarFallback
                  className="text-xs"
                  style={{ backgroundColor: user.color, color: 'white' }}
                >
                  {user.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{user.displayName}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarFallback className="text-xs">+{overflow}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </TooltipProvider>
  );
}
