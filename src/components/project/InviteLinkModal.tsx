import React from 'react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface InviteLinkModalProps {
  projectId: string;
  inviteCode?: string;
}

export default function InviteLinkModal({ projectId, inviteCode }: InviteLinkModalProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Invite Link</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Project Invite Link</SheetTitle>
          <SheetDescription>
            Share this code with teammates to let them join the project.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 p-2 bg-muted rounded font-mono text-sm">
          {inviteCode || 'No invite code yet'}
        </div>
        <SheetFooter className="flex justify-end mt-4">
          <SheetClose asChild>
            <Button>Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
