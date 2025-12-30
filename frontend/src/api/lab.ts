import { LabIdea } from '../lab/types';

export async function fetchLabIdeas(): Promise<LabIdea[]> {
  const res = await fetch('/api/lab/ideas');
  if (!res.ok) {
    throw new Error(`Failed to fetch ideas: ${res.status}`);
  }
  return res.json();
}

export async function saveLabIdea(idea: LabIdea): Promise<LabIdea> {
  const res = await fetch('/api/lab/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idea),
  });

  if (!res.ok) {
    throw new Error(`Failed to save idea: ${res.status}`);
  }

  return res.json();
}
