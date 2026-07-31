import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface MemberListProps {
  projectId: string;
}

export default function MemberList({ projectId }: MemberListProps) {
  // Placeholder: fetch and display members of the project
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Members</CardTitle>
      </CardHeader>
      <CardContent>
        {/* TODO: Replace with real member list */}
        <p>Members for project {projectId} will be displayed here.</p>
      </CardContent>
    </Card>
  );
}
