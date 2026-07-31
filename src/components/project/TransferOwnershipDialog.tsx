import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TransferOwnershipDialogProps {
  projectId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onTransfer?: (newOwnerId: string) => void;
}

export default function TransferOwnershipDialog({ projectId, open, onOpenChange, onTransfer }: TransferOwnershipDialogProps) {
  const [newOwnerId, setNewOwnerId] = React.useState('');

  const handleTransfer = () => {
    if (newOwnerId) {
      onTransfer?.(newOwnerId);
      onOpenChange?.(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Transfer Ownership</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Project Ownership</DialogTitle>
          <DialogDescription>
            Enter the user ID of the new owner and confirm the transfer.
          </DialogDescription>
        </DialogHeader>
        <input
          type="text"
          placeholder="New owner user ID"
          value={newOwnerId}
          onChange={e => setNewOwnerId(e.target.value)}
          className="w-full rounded border p-2"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!newOwnerId}>
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
