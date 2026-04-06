export function createPersonNode(overrides = {}) {
  return {
    id: overrides.id || 'person-1',
    type: 'person',
    data: {
      name: 'John',
      surname: 'Doe',
      maidenName: null,
      birthDate: '1990-01-15',
      deathDate: null,
      street: null,
      housenumber: null,
      city: null,
      zip: null,
      country: null,
      phone: null,
      email: null,
      bloodline: true,
      hasTaggedImage: false,
      ...overrides.data,
    },
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

export function createFamilyNode(overrides = {}) {
  return {
    id: overrides.id || 'family-1',
    type: 'family',
    data: { ...overrides.data },
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

export function createPartnerNode(overrides = {}) {
  return createPersonNode({
    id: overrides.id || 'partner-1',
    data: {
      name: 'Jane',
      surname: 'Doe',
      bloodline: false,
      ...overrides.data,
    },
    ...overrides,
  });
}
