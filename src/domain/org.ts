export type OrgMember = {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  kind: string;
  endDate: string | null;
  managerId: number | null;
};

export type OrgNode = OrgMember & { children: OrgNode[] };

export type OrgChart = {
  roots: OrgNode[];
  former: OrgMember[];
  total: number;
  depth: number;
};

function compareName(a: OrgMember, b: OrgMember): number {
  return a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de") || a.id - b.id;
}

function depthOf(nodes: OrgNode[]): number {
  let depth = 0;
  for (const node of nodes) depth = Math.max(depth, 1 + depthOf(node.children));
  return depth;
}

/**
 * Turns a flat list of people into a top-down tree. A manager who is missing or
 * outside the list leaves the person at the top; a loop is broken at its lowest
 * id so the page always renders, even if the stored data is wrong.
 */
export function buildOrgChart(members: OrgMember[], today: string): OrgChart {
  const active = members.filter((member) => member.endDate === null || member.endDate >= today);
  const former = members.filter((member) => member.endDate !== null && member.endDate < today).sort(compareName);
  const known = new Set(active.map((member) => member.id));
  const managerOf = new Map<number, number | null>();
  for (const member of active) {
    const manager = member.managerId;
    managerOf.set(member.id, manager !== null && manager !== member.id && known.has(manager) ? manager : null);
  }

  for (const member of active) {
    const seen = new Set<number>();
    let current: number | null = member.id;
    while (current !== null) {
      if (seen.has(current)) {
        let lowest = current;
        let cursor = managerOf.get(current) ?? null;
        while (cursor !== null && cursor !== current) {
          lowest = Math.min(lowest, cursor);
          cursor = managerOf.get(cursor) ?? null;
        }
        managerOf.set(lowest, null);
        break;
      }
      seen.add(current);
      current = managerOf.get(current) ?? null;
    }
  }

  const nodes = new Map<number, OrgNode>();
  for (const member of active) {
    nodes.set(member.id, { ...member, managerId: managerOf.get(member.id) ?? null, children: [] });
  }

  const roots: OrgNode[] = [];
  for (const member of active) {
    const node = nodes.get(member.id)!;
    const managerId = managerOf.get(member.id) ?? null;
    const parent = managerId === null ? null : nodes.get(managerId) ?? null;
    if (parent === null) roots.push(node);
    else parent.children.push(node);
  }

  for (const node of nodes.values()) node.children.sort(compareName);
  roots.sort(compareName);

  return { roots, former, total: active.length, depth: depthOf(roots) };
}

/** Empty when the reporting line is valid, otherwise the sentence to show. */
export function managerProblem(
  members: { id: number; managerId: number | null }[],
  employeeId: number | null,
  managerId: number | null,
): string {
  if (managerId === null) return "";
  const byId = new Map(members.map((member) => [member.id, member]));
  if (!byId.has(managerId)) return "Manager not found.";
  if (employeeId !== null && managerId === employeeId) return "A person cannot report to themselves.";
  const seen = new Set<number>();
  let current: number | null = managerId;
  while (current !== null) {
    if (current === employeeId || seen.has(current)) return "The reporting line would form a loop.";
    seen.add(current);
    current = byId.get(current)?.managerId ?? null;
  }
  return "";
}