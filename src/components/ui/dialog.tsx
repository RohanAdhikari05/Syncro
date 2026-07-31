import * as React from 'react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const [isOpen, setIsOpen] = React.useState(open ?? false);
  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleOpenChange = (value: boolean) => {
    setIsOpen(value);
    onOpenChange?.(value);
  };

  return (
    <dialog open={isOpen} onClose={() => handleOpenChange(false)} className="rounded-lg border p-4 shadow-lg backdrop:bg-black/30">
      {children}
    </dialog>
  );
};



export const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-2">{children}</div>
);

export const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="font-semibold text-lg mb-2">{children}</div>
);

export const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xl font-bold mb-1">{children}</h2>
);

export const DialogDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground mb-2">{children}</p>
);

export const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-end space-x-2 mt-4">{children}</div>
);

export const DialogTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
  if (asChild) {
    return <>{children}</>;
  }
  return (
    <button type="button" className="inline-flex items-center justify-center">
      {children}
    </button>
  );
};
