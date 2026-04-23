// Centralized proposal definition. For v1 we ship a single demo proposal;
// a proposal registry is a v2 roadmap item.

export interface ProposalOption {
  id: string;
  label: string;
}

export interface Proposal {
  id: string;
  title: string;
  options: ProposalOption[];
}

export const DEMO_PROPOSAL: Proposal = {
  id: 'demo-2026-04',
  title: 'Should the World ecosystem prioritize privacy primitives in 2026?',
  options: [
    { id: 'yes', label: 'Yes — privacy is foundational' },
    { id: 'no', label: 'No — focus on growth first' },
    { id: 'mixed', label: 'Mixed — depends on use case' },
  ],
};

export const PROPOSALS: Record<string, Proposal> = {
  [DEMO_PROPOSAL.id]: DEMO_PROPOSAL,
};

export function getProposal(id: string): Proposal | null {
  return PROPOSALS[id] ?? null;
}
