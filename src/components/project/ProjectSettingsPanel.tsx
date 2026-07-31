import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/components/ui/ToastProvider';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import InviteLinkModal from '@/components/project/InviteLinkModal';
import TransferOwnershipDialog from '@/components/project/TransferOwnershipDialog';
import MemberList from '@/components/project/MemberList';

// Zod schema for editing project details
type EditProjectForm = {
  name: string;
  description?: string;
};

const editProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
});

interface ProjectSettingsPanelProps {
  projectId: string;
  initialName: string;
  initialDescription?: string;
}

export default function ProjectSettingsPanel({ projectId, initialName, initialDescription }: ProjectSettingsPanelProps) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'edit' | 'invite' | 'transfer' | 'members'>('edit');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditProjectForm>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: { name: initialName, description: initialDescription },
  });

  const onSubmit = async (data: EditProjectForm) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to update project');
      addToast('Project updated successfully', 'success');
    } catch (e: any) {
      addToast(e.message ?? 'Error updating project', 'error');
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Tab navigation */}
      <div className="flex space-x-4 border-b pb-2">
        {(['edit', 'invite', 'transfer', 'members'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-t-md ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-muted'} `}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content based on active tab */}
      {activeTab === 'edit' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">Name</label>
            <input
              id="name"
              {...register('name')}
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="description">Description</label>
            <textarea
              id="description"
              {...register('description')}
              rows={4}
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            />
            {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      )}

      {activeTab === 'invite' && <InviteLinkModal projectId={projectId} />}
      {activeTab === 'transfer' && <TransferOwnershipDialog projectId={projectId} />}
      {activeTab === 'members' && <MemberList projectId={projectId} />}
    </div>
  );
}
