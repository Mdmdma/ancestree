export function createEdge(overrides = {}) {
  return {
    id: overrides.id || 'edge-1',
    source: overrides.source || 'person-1',
    target: overrides.target || 'family-1',
    sourceHandle: overrides.sourceHandle || 'child',
    targetHandle: overrides.targetHandle || 'parentconnection',
    type: overrides.type || 'bloodline',
    ...overrides,
  };
}

export function createPartnerEdge(overrides = {}) {
  return createEdge({
    id: overrides.id || 'partner-edge-1',
    source: overrides.source || 'person-1',
    target: overrides.target || 'partner-1',
    sourceHandle: 'partner-left',
    targetHandle: 'partner-right',
    type: 'partner',
    ...overrides,
  });
}
