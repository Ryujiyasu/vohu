// POST /api/propose
//
// Create a new proposal. Body:
//   {
//     title:   string,
//     options: { id: string, label: string }[],
//     scope?:  {
//       kind: 'xmtp-group',
//       groupId: string,
//       groupName?: string,
//       allowedAddresses: string[]
//     }
//   }
//
// Returns { proposal, shareUrl }. The organizer shares `shareUrl` (typically
// by posting it in the target World Chat group).
//
// v1 does NOT authenticate the organizer — any client can create a proposal.
// This is acceptable because proposals are isolated by id and the Paillier
// trustees (for unscoped proposals) or the allowedAddresses (for scoped
// proposals) determine who can actually vote. A spammer at worst consumes
// Redis space.

import { NextRequest, NextResponse } from 'next/server';
import {
  Proposal,
  ProposalOption,
  ProposalScope,
  newProposalId,
  saveProposal,
} from '@/lib/proposal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_OPTIONS = 8;
const MAX_TITLE_LEN = 280;
const MAX_OPTION_LABEL_LEN = 120;
const MAX_GROUP_MEMBERS = 250;

function cleanAddress(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(s) ? s : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { title, options, scope } = body as {
    title?: unknown;
    options?: unknown;
    scope?: unknown;
  };

  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: 'invalid title' }, { status: 400 });
  }
  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > MAX_OPTIONS
  ) {
    return NextResponse.json({ error: 'invalid options array' }, { status: 400 });
  }
  const cleanOptions: ProposalOption[] = [];
  for (const o of options) {
    if (
      typeof o !== 'object' ||
      o === null ||
      typeof (o as { id?: unknown }).id !== 'string' ||
      typeof (o as { label?: unknown }).label !== 'string'
    ) {
      return NextResponse.json({ error: 'invalid option' }, { status: 400 });
    }
    const opt = o as ProposalOption;
    if (
      !opt.id.trim() ||
      !opt.label.trim() ||
      opt.label.length > MAX_OPTION_LABEL_LEN
    ) {
      return NextResponse.json({ error: 'invalid option fields' }, { status: 400 });
    }
    cleanOptions.push({ id: opt.id.trim(), label: opt.label.trim() });
  }

  let cleanScope: ProposalScope | undefined = undefined;
  if (scope !== undefined && scope !== null) {
    if (
      typeof scope !== 'object' ||
      (scope as { kind?: unknown }).kind !== 'xmtp-group'
    ) {
      return NextResponse.json({ error: 'invalid scope' }, { status: 400 });
    }
    const s = scope as {
      groupId?: unknown;
      groupName?: unknown;
      allowedAddresses?: unknown;
    };
    if (typeof s.groupId !== 'string' || !s.groupId.trim()) {
      return NextResponse.json({ error: 'scope.groupId required' }, { status: 400 });
    }
    if (!Array.isArray(s.allowedAddresses) || s.allowedAddresses.length === 0) {
      return NextResponse.json(
        { error: 'scope.allowedAddresses must be a non-empty array' },
        { status: 400 },
      );
    }
    if (s.allowedAddresses.length > MAX_GROUP_MEMBERS) {
      return NextResponse.json(
        { error: `scope.allowedAddresses must have at most ${MAX_GROUP_MEMBERS} entries` },
        { status: 400 },
      );
    }
    const allowed: string[] = [];
    for (const a of s.allowedAddresses) {
      const c = cleanAddress(a);
      if (!c) {
        return NextResponse.json(
          { error: `invalid address in scope.allowedAddresses` },
          { status: 400 },
        );
      }
      allowed.push(c);
    }
    cleanScope = {
      kind: 'xmtp-group',
      groupId: s.groupId.trim(),
      groupName:
        typeof s.groupName === 'string' ? s.groupName.slice(0, 120) : undefined,
      allowedAddresses: Array.from(new Set(allowed)),
      snapshotAt: Date.now(),
    };
  }

  const id = newProposalId();
  const proposal: Proposal = {
    id,
    title: title.trim(),
    options: cleanOptions,
    scope: cleanScope,
    createdAt: Date.now(),
  };
  await saveProposal(proposal);

  const origin = req.nextUrl.origin;
  const shareUrl = `${origin}/vote?p=${encodeURIComponent(id)}`;

  return NextResponse.json({ proposal, shareUrl });
}
