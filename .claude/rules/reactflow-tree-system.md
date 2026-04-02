---
paths:
  - "ancestree-app/src/FamilyTree.jsx"
  - "ancestree-app/src/*Node.jsx"
  - "ancestree-app/src/*Edge.jsx"
  - "ancestree-app/src/CustomHandle.jsx"
---

# ReactFlow Tree System

Family tree visualization using @xyflow/react with ELK layout engine.

## Node Types

Registered in `nodeTypes` object in FamilyTree.jsx:

### `person` (PersonNode.jsx)
- Two states: **collapsed** (name only, ~120x40px) and **expanded** (full details, ~200px wide) based on `selected` prop
- Uses **inline styles** (NOT Tailwind — existing exception, do not convert without permission)
- CSS variables for theming: `--node-person-bg`, `--node-person-border`, etc.
- Completion indicator: red border (incomplete) / green border (complete) based on `completionSettings`
- Skip markers (`000`) filtered via `getDisplayValue()` — hidden in tree display
- `bloodline` flag determines connection restrictions (true = bloodline member, false = partner/married-in)

### `family` (FamilyNode.jsx)
- 40px circle, not user-selectable
- Virtual node — not a real person, exists only to structure parent-child relationships
- Dynamic child ports with angular distribution around the circle
- Uses **inline styles** (same exception as PersonNode)

## Edge Types

Registered in `edgeTypes` object:

| Type | Component | Visual | Purpose |
|------|-----------|--------|---------|
| `partner` | PartnerEdge | Green BezierEdge | Active romantic relationship |
| `expartner` | PartnerEdge | Gray+dashed BezierEdge | Former relationship |
| `bloodline` | BloodlineEdge | Blue vertical | Visible parent-child connection |
| `bloodlinehidden` | BloodlineEdgeHidden | Hidden | Internal structural connection |
| `bloodlinefake` | BloodlineEdgeFake | UI-only | Not saved to DB |

PartnerEdge has toggle button at midpoint (partner ↔ expartner). In debug mode, clicking expartner deletes it.

## Handle System (CustomHandle.jsx)

Handle IDs and their positions on nodes:

**PersonNode handles:**
| Handle ID | Position | ReactFlow Type | Purpose |
|-----------|----------|----------------|---------|
| `parent` | Top | target | Incoming connection from family node |
| `child` | Bottom | source | Outgoing connection to family node |
| `partner-left` | Left | source | Partner connection (outgoing) |
| `partner-right` | Right | target | Partner connection (incoming) |

**FamilyNode handles:**
| Handle ID | Position | ReactFlow Type | Purpose |
|-----------|----------|----------------|---------|
| `parentconnection` | Top | target | Receives connections from parent persons |
| `childrenconnection` | Bottom | source | Base connection to children |
| `port-N` | Dynamic | source | Per-child ports, angularly distributed |

## Connection Validation Rules

`validateConnection()` function (~180 lines) enforces these business rules:

1. **No family-to-family**: Direct connections between two FamilyNodes are prohibited
2. **No family-parentconnection to partner handle**: FamilyNode parentconnection cannot connect to person's partner handles
3. **Partner edge requirement**: When connecting person to family's parentconnection, all existing parents of that family must have partner edges with the new parent
4. **No direct person parent-to-child**: Person parent↔child connections must go through a FamilyNode (no shortcuts)
5. **Partner node partner-handle restriction**: Non-bloodline (partner) nodes cannot use partner handles to connect to other non-bloodline nodes — at least one side must be bloodline
6. **Partner node single-partner limit**: Non-bloodline nodes can have max 1 partner connection
7. **No bloodline-to-bloodline partners**: Two bloodline nodes cannot have partner edges between them
8. **Partner node parent restriction**: Non-bloodline nodes cannot use the parent handle
9. **Bloodline single-parent limit**: Bloodline nodes can have max 1 parent connection (to a family node)

Helper functions used:
- `countParentConnections(node)` — counts edges using parent handle
- `hasPartnerEdgeBetween(id1, id2)` — checks for partner/expartner edge
- `getParentsOfFamily(familyNodeId)` — gets person IDs connected to parentconnection
- `isBloodlineNode(node)` — checks `node.data.bloodline` flag
- `isPartnerEdge(edge)` — checks type === 'partner' || 'expartner'

## ELK Layout (`autoLayout` callback)

Two-phase layout algorithm:

### Phase 1: Build clusters
For each bloodline node:
1. Collect partners (connected via partner/expartner edges)
2. Sort partners by connection count (descending)
3. Create FamilyNode entries positioned below parent cluster
4. Family node X = average X of feeding parent nodes
5. Group into ELK cluster node with ports

### Phase 2: ELK layered algorithm
```javascript
'elk.algorithm': 'layered'
'elk.direction': 'DOWN'
'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP'
'elk.layered.crossingMinimization.hierarchicalSweepiness': '0.9'
'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
'elk.layered.nodePlacement.favorStraightEdges': 'true'
'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES'
'elk.layered.thoroughness': '7'
'elk.spacing.portPort': '15'
'elk.spacing.nodeNode': '80'
'elk.separateConnectedComponents': 'false'
```

Port-based edges between clusters for inter-family bloodline connections. Layout is computationally expensive — avoid triggering unnecessarily.

## Real-Time Collaboration

Socket.IO events in FamilyTree.jsx:
- Listens for: `node:created`, `node:updated`, `node:deleted`, `node:position`, `edge:created`, `edge:updated`, `edge:deleted`
- Position updates debounced 300ms (broadcast to other users, save on drag end)
- `batchOperationActive` flag checked every 500ms — pauses renders during encryption batch operations

## Encryption Integration

- Decrypts nodes/edges on load using `decryptNodeData`/`decryptEdgeData` from encryptedApi
- `hasEncryptedNodeProperties()` / `hasEncryptedProperties()` helpers detect undecrypted data
- If encryption key missing: logs warnings but renders anyway (graceful degradation)

## ID Generation

```javascript
const getId = () => crypto.randomUUID?.() || `id-${Math.random().toString(36).slice(2,9)}-${Date.now().toString(36)}`;
```

## Key Constants

- `nodeOrigin = [0.5, 0]` — nodes anchored at top-center
- PersonNode collapsed: ~120x40px, expanded: ~200px wide
- FamilyNode: 40px circle
