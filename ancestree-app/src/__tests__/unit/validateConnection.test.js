import { validateConnection, isPartnerEdge, isBloodlineNode } from '../../connectionValidation';
import { createPersonNode, createFamilyNode, createPartnerNode } from '../helpers/createMockNode';
import { createEdge, createPartnerEdge } from '../helpers/createMockEdge';

const t = {
  ui: {
    editor: {
      validationMessages: {
        familyToFamily: 'No family-to-family connections',
        familyParentToPartnerHandle: 'Cannot connect family to partner handle',
        missingPartnerEdge: 'Missing partner edge between {name1} and {name2}',
        directParentChild: 'No direct parent-child connections',
        partnerNodePartnerHandle: '{name} cannot use partner handle',
        partnerNodeMultiplePartners: '{name} already has a partner',
        bloodlineToBloodlinePartner: 'Bloodline nodes cannot be partners',
        partnerNodeParentHandle: '{name} cannot use parent handle',
        bloodlineMultipleParents: '{name} already has {count} parent connection(s)',
      },
    },
  },
};

describe('connectionValidation', () => {
  describe('isPartnerEdge', () => {
    it('returns true for partner type', () => {
      expect(isPartnerEdge({ type: 'partner' })).toBe(true);
    });

    it('returns true for expartner type', () => {
      expect(isPartnerEdge({ type: 'expartner' })).toBe(true);
    });

    it('returns false for other types', () => {
      expect(isPartnerEdge({ type: 'bloodline' })).toBe(false);
      expect(isPartnerEdge({ type: 'child' })).toBe(false);
    });
  });

  describe('isBloodlineNode', () => {
    it('returns true for family nodes', () => {
      const familyNode = createFamilyNode();
      expect(isBloodlineNode(familyNode)).toBe(true);
    });

    it('returns true for person nodes with bloodline: true', () => {
      const personNode = createPersonNode({ data: { bloodline: true } });
      expect(isBloodlineNode(personNode)).toBe(true);
    });

    it('returns false for partner nodes (bloodline: false)', () => {
      const partnerNode = createPartnerNode();
      expect(isBloodlineNode(partnerNode)).toBe(false);
    });
  });

  describe('validateConnection', () => {
    // Rule 1: Family-to-family connections are prohibited
    describe('Rule 1: family-to-family', () => {
      it('rejects connection between two family nodes', () => {
        const family1 = createFamilyNode({ id: 'f1' });
        const family2 = createFamilyNode({ id: 'f2' });
        const result = validateConnection(family1, family2, 'parentconnection', 'parentconnection', [], t, []);
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('No family-to-family connections');
      });
    });

    // Rule 2: Family parentconnection to partner handle is prohibited
    describe('Rule 2: family parentconnection to partner handle', () => {
      it('rejects family source with parentconnection to person partner handle', () => {
        const family = createFamilyNode();
        const person = createPersonNode();
        const result = validateConnection(family, person, 'parentconnection', 'partner-left', [], t, []);
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Cannot connect family to partner handle');
      });

      it('rejects person partner handle to family parentconnection', () => {
        const person = createPersonNode();
        const family = createFamilyNode();
        const result = validateConnection(person, family, 'partner-left', 'parentconnection', [], t, []);
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Cannot connect family to partner handle');
      });
    });

    // Rule 3: Partner edge requirement when connecting person to family parentconnection
    describe('Rule 3: partner edge requirement', () => {
      it('rejects person to family parentconnection without partner edge to existing parent', () => {
        const existingParent = createPersonNode({ id: 'parent-1', data: { name: 'Alice' } });
        const newParent = createPersonNode({ id: 'parent-2', data: { name: 'Bob' } });
        const family = createFamilyNode({ id: 'family-1' });

        // Existing edge: parent-1 -> family-1 via parentconnection
        const edges = [
          createEdge({
            id: 'e1',
            source: 'parent-1',
            target: 'family-1',
            sourceHandle: 'child',
            targetHandle: 'parentconnection',
          }),
        ];
        const nodes = [existingParent, newParent, family];

        const result = validateConnection(
          newParent, family, 'child', 'parentconnection', edges, t, nodes
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Missing partner edge between Bob and Alice');
      });

      it('allows person to family parentconnection when partner edge exists', () => {
        const existingParent = createPersonNode({ id: 'parent-1', data: { name: 'Alice' } });
        const newParent = createPartnerNode({ id: 'parent-2', data: { name: 'Bob', bloodline: false } });
        const family = createFamilyNode({ id: 'family-1' });

        const edges = [
          createEdge({
            id: 'e1',
            source: 'parent-1',
            target: 'family-1',
            sourceHandle: 'child',
            targetHandle: 'parentconnection',
          }),
          createPartnerEdge({
            id: 'pe1',
            source: 'parent-2',
            target: 'parent-1',
          }),
        ];
        const nodes = [existingParent, newParent, family];

        const result = validateConnection(
          newParent, family, 'child', 'parentconnection', edges, t, nodes
        );
        expect(result.isValid).toBe(true);
      });

      it('also checks reverse direction (family parentconnection as source)', () => {
        const existingParent = createPersonNode({ id: 'parent-1', data: { name: 'Alice' } });
        const newParent = createPersonNode({ id: 'parent-2', data: { name: 'Bob' } });
        const family = createFamilyNode({ id: 'family-1' });

        const edges = [
          createEdge({
            id: 'e1',
            source: 'parent-1',
            target: 'family-1',
            sourceHandle: 'child',
            targetHandle: 'parentconnection',
          }),
        ];
        const nodes = [existingParent, newParent, family];

        const result = validateConnection(
          family, newParent, 'parentconnection', 'child', edges, t, nodes
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Missing partner edge between Bob and Alice');
      });
    });

    // Rule 4: Direct person parent-to-child connections are prohibited
    describe('Rule 4: direct parent-child', () => {
      it('rejects person parent handle to person child handle', () => {
        const parent = createPersonNode({ id: 'p1', data: { name: 'Alice' } });
        const child = createPersonNode({ id: 'p2', data: { name: 'Bob' } });
        const result = validateConnection(parent, child, 'parent', 'child', [], t, []);
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('No direct parent-child connections');
      });

      it('rejects person child handle to person parent handle', () => {
        const child = createPersonNode({ id: 'p1', data: { name: 'Alice' } });
        const parent = createPersonNode({ id: 'p2', data: { name: 'Bob' } });
        const result = validateConnection(child, parent, 'child', 'parent', [], t, []);
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('No direct parent-child connections');
      });
    });

    // Rule 5: Partner node using partner handle to connect to another partner node
    describe('Rule 5: partner node partner handle to partner node', () => {
      it('rejects two non-bloodline nodes connecting via partner handles', () => {
        const partner1 = createPartnerNode({ id: 'partner-1', data: { name: 'Jane', bloodline: false } });
        const partner2 = createPartnerNode({ id: 'partner-2', data: { name: 'Eve', bloodline: false } });

        const result = validateConnection(
          partner1, partner2, 'partner-left', 'partner-right', [], t, []
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Jane cannot use partner handle');
      });
    });

    // Rule 6: Partner node with existing partner connection
    describe('Rule 6: partner node multiple partners', () => {
      it('rejects partner node that already has a partner connection (source side)', () => {
        const partnerNode = createPartnerNode({ id: 'partner-1', data: { name: 'Jane', bloodline: false } });
        const bloodlineNode = createPersonNode({ id: 'person-1', data: { name: 'John', bloodline: true } });
        const newBloodline = createPersonNode({ id: 'person-2', data: { name: 'Bob', bloodline: true } });

        const edges = [
          createPartnerEdge({
            id: 'pe1',
            source: 'partner-1',
            target: 'person-1',
          }),
        ];

        const result = validateConnection(
          partnerNode, newBloodline, 'partner-left', 'partner-right', edges, t, []
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Jane already has a partner');
      });

      it('rejects partner node that already has a partner connection (target side)', () => {
        const bloodlineNode = createPersonNode({ id: 'person-1', data: { name: 'John', bloodline: true } });
        const partnerNode = createPartnerNode({ id: 'partner-1', data: { name: 'Jane', bloodline: false } });
        const newBloodline = createPersonNode({ id: 'person-2', data: { name: 'Bob', bloodline: true } });

        const edges = [
          createPartnerEdge({
            id: 'pe1',
            source: 'person-1',
            target: 'partner-1',
          }),
        ];

        const result = validateConnection(
          newBloodline, partnerNode, 'partner-left', 'partner-right', edges, t, []
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Jane already has a partner');
      });
    });

    // Rule 7: Bloodline-to-bloodline via partner handles
    describe('Rule 7: bloodline to bloodline partner', () => {
      it('rejects partner connection between two bloodline nodes', () => {
        const person1 = createPersonNode({ id: 'p1', data: { name: 'Alice', bloodline: true } });
        const person2 = createPersonNode({ id: 'p2', data: { name: 'Bob', bloodline: true } });

        const result = validateConnection(
          person1, person2, 'partner-left', 'partner-right', [], t, []
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Bloodline nodes cannot be partners');
      });
    });

    // Rule 8: Partner node using parent handle
    describe('Rule 8: partner node parent handle', () => {
      it('rejects partner node (non-bloodline) using parent handle as source', () => {
        const partnerNode = createPartnerNode({ id: 'partner-1', data: { name: 'Jane', bloodline: false } });
        const familyNode = createFamilyNode({ id: 'family-1' });

        const result = validateConnection(
          partnerNode, familyNode, 'parent', 'parentconnection', [], t, []
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Jane cannot use parent handle');
      });

      it('rejects partner node (non-bloodline) using parent handle as target', () => {
        const familyNode = createFamilyNode({ id: 'family-1' });
        const partnerNode = createPartnerNode({ id: 'partner-1', data: { name: 'Jane', bloodline: false } });

        const result = validateConnection(
          familyNode, partnerNode, 'parentconnection', 'parent', [], t, []
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Jane cannot use parent handle');
      });
    });

    // Rule 9: Bloodline node with existing parent connection
    describe('Rule 9: bloodline multiple parents', () => {
      it('rejects bloodline node that already has a parent connection (source side)', () => {
        const person = createPersonNode({ id: 'p1', data: { name: 'Alice', bloodline: true } });
        const family1 = createFamilyNode({ id: 'f1' });
        const family2 = createFamilyNode({ id: 'f2' });

        const edges = [
          createEdge({
            id: 'e1',
            source: 'p1',
            target: 'f1',
            sourceHandle: 'parent',
            targetHandle: 'parentconnection',
          }),
        ];

        const result = validateConnection(
          person, family2, 'parent', 'parentconnection', edges, t, []
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Alice already has 1 parent connection(s)');
      });

      it('rejects bloodline node that already has a parent connection (target side)', () => {
        const family1 = createFamilyNode({ id: 'f1' });
        const family2 = createFamilyNode({ id: 'f2' });
        const person = createPersonNode({ id: 'p1', data: { name: 'Alice', bloodline: true } });

        const edges = [
          createEdge({
            id: 'e1',
            source: 'f1',
            target: 'p1',
            sourceHandle: 'parentconnection',
            targetHandle: 'parent',
          }),
        ];

        const result = validateConnection(
          family2, person, 'parentconnection', 'parent', edges, t, []
        );
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Alice already has 1 parent connection(s)');
      });
    });

    // Rule 10: Valid connection passes all checks
    describe('valid connections', () => {
      it('allows bloodline person to partner node via partner handles', () => {
        const bloodline = createPersonNode({ id: 'p1', data: { name: 'John', bloodline: true } });
        const partner = createPartnerNode({ id: 'partner-1', data: { name: 'Jane', bloodline: false } });

        const result = validateConnection(
          bloodline, partner, 'partner-left', 'partner-right', [], t, []
        );
        expect(result.isValid).toBe(true);
        expect(result.message).toBeNull();
      });

      it('allows person child handle to family parentconnection', () => {
        const person = createPersonNode({ id: 'p1', data: { name: 'John', bloodline: true } });
        const family = createFamilyNode({ id: 'f1' });

        const result = validateConnection(
          person, family, 'child', 'parentconnection', [], t, []
        );
        expect(result.isValid).toBe(true);
        expect(result.message).toBeNull();
      });

      it('allows bloodline person parent handle to family when no existing parent connection', () => {
        const person = createPersonNode({ id: 'p1', data: { name: 'John', bloodline: true } });
        const family = createFamilyNode({ id: 'f1' });

        const result = validateConnection(
          person, family, 'parent', 'parentconnection', [], t, []
        );
        expect(result.isValid).toBe(true);
        expect(result.message).toBeNull();
      });
    });
  });
});
