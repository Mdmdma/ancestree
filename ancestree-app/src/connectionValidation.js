// Helper function to check if an edge is a partner or expartner edge
export const isPartnerEdge = (edge) => {
  return edge.type === 'partner' || edge.type === 'expartner';
};

// Helper function to check if a node is on the bloodline
// Family nodes are always considered bloodline nodes
export const isBloodlineNode = (node) => {
  return node.type === 'family' || node.data.bloodline;
};

// Validation function for connection rules
export const validateConnection = (sourceNode, targetNode, sourceHandle, targetHandle, edges, t, nodes) => {
  // Helper function to count parent handle connections for a node
  const countParentConnections = (node) => {
    return edges.filter(edge =>
      (edge.source === node.id && edge.sourceHandle === 'parent') ||
      (edge.target === node.id && edge.targetHandle === 'parent')
    ).length;
  };

  // Helper function to check if two persons have a partner edge between them
  const hasPartnerEdgeBetween = (personId1, personId2) => {
    return edges.some(edge =>
      isPartnerEdge(edge) &&
      ((edge.source === personId1 && edge.target === personId2) ||
       (edge.source === personId2 && edge.target === personId1))
    );
  };

  // Helper function to get all persons connected to a family's parentconnection
  const getParentsOfFamily = (familyNodeId) => {
    return edges
      .filter(edge =>
        (edge.target === familyNodeId && edge.targetHandle === 'parentconnection') ||
        (edge.source === familyNodeId && edge.sourceHandle === 'parentconnection')
      )
      .map(edge => edge.target === familyNodeId ? edge.source : edge.target);
  };

  // Prohibit direct Family-to-Family connections
  if (sourceNode.type === 'family' && targetNode.type === 'family') {
    return {
      isValid: false,
      message: t.ui.editor.validationMessages.familyToFamily
    };
  }

  // Family parentconnection can only connect to person child handles (not partner handles)
  if (sourceNode.type === 'family' && targetNode.type === 'person') {
    if (sourceHandle === 'parentconnection' && targetHandle?.includes('partner')) {
      return {
        isValid: false,
        message: t.ui.editor.validationMessages.familyParentToPartnerHandle
      };
    }
  }

  if (sourceNode.type === 'person' && targetNode.type === 'family') {
    if (targetHandle === 'parentconnection' && sourceHandle?.includes('partner')) {
      return {
        isValid: false,
        message: t.ui.editor.validationMessages.familyParentToPartnerHandle
      };
    }
  }

  // When connecting a person to a family's parentconnection, check partner edges with existing parents
  if (targetNode.type === 'family' && targetHandle === 'parentconnection' && sourceNode.type === 'person') {
    const existingParentIds = getParentsOfFamily(targetNode.id);

    for (const existingParentId of existingParentIds) {
      if (existingParentId !== sourceNode.id && !hasPartnerEdgeBetween(sourceNode.id, existingParentId)) {
        // Find the existing parent's name for the error message
        const existingParentNode = nodes?.find(n => n.id === existingParentId);
        const existingParentName = existingParentNode?.data?.name || 'Unknown';
        const newParentName = sourceNode.data?.name || 'Unknown';

        return {
          isValid: false,
          message: t.ui.editor.validationMessages.missingPartnerEdge
            .replace('{name1}', newParentName)
            .replace('{name2}', existingParentName)
        };
      }
    }
  }

  // Also check the reverse direction (family's parentconnection as source)
  if (sourceNode.type === 'family' && sourceHandle === 'parentconnection' && targetNode.type === 'person') {
    const existingParentIds = getParentsOfFamily(sourceNode.id);

    for (const existingParentId of existingParentIds) {
      if (existingParentId !== targetNode.id && !hasPartnerEdgeBetween(targetNode.id, existingParentId)) {
        // Find the existing parent's name for the error message
        const existingParentNode = nodes?.find(n => n.id === existingParentId);
        const existingParentName = existingParentNode?.data?.name || 'Unknown';
        const newParentName = targetNode.data?.name || 'Unknown';

        return {
          isValid: false,
          message: t.ui.editor.validationMessages.missingPartnerEdge
            .replace('{name1}', newParentName)
            .replace('{name2}', existingParentName)
        };
      }
    }
  }

  // Prohibit direct Person parent-to-child connections
  if (sourceNode.type === 'person' && targetNode.type === 'person') {
    if ((sourceHandle === 'parent' && targetHandle === 'child') ||
        (sourceHandle === 'child' && targetHandle === 'parent')) {
      return {
        isValid: false,
        message: t.ui.editor.validationMessages.directParentChild
      };
    }
  }

  // Check partner handle restrictions for partner nodes
  if (sourceNode.type === 'person' && targetNode.type === 'person' &&
      (sourceHandle?.includes('partner') || targetHandle?.includes('partner'))) {

    // Check if source is a partner node trying to use partner handles
    // Allow if target is bloodline (bloodline nodes can connect to partners)
    if (!isBloodlineNode(sourceNode) && sourceHandle?.includes('partner') && !isBloodlineNode(targetNode)) {
      return {
        isValid: false,
        message: t.ui.editor.validationMessages.partnerNodePartnerHandle.replace('{name}', sourceNode.data.name)
      };
    }

    // Check if target is a partner node trying to use partner handles
    // Allow if source is bloodline (bloodline nodes can connect to partners)
    if (!isBloodlineNode(targetNode) && targetHandle?.includes('partner') && !isBloodlineNode(sourceNode)) {
      return {
        isValid: false,
        message: t.ui.editor.validationMessages.partnerNodePartnerHandle.replace('{name}', targetNode.data.name)
      };
    }

    // Check if source partner node already has a partner connection
    if (!isBloodlineNode(sourceNode) && sourceHandle?.includes('partner')) {
      const existingPartnerConnections = edges.filter(edge =>
        isPartnerEdge(edge) &&
        (edge.source === sourceNode.id || edge.target === sourceNode.id)
      );
      if (existingPartnerConnections.length >= 1) {
        return {
          isValid: false,
          message: t.ui.editor.validationMessages.partnerNodeMultiplePartners.replace('{name}', sourceNode.data.name)
        };
      }
    }

    // Check if target partner node already has a partner connection
    if (!isBloodlineNode(targetNode) && targetHandle?.includes('partner')) {
      const existingPartnerConnections = edges.filter(edge =>
        isPartnerEdge(edge) &&
        (edge.source === targetNode.id || edge.target === targetNode.id)
      );
      if (existingPartnerConnections.length >= 1) {
        return {
          isValid: false,
          message: t.ui.editor.validationMessages.partnerNodeMultiplePartners.replace('{name}', targetNode.data.name)
        };
      }
    }

    // Prohibit partner connections between two bloodline nodes
    if (isBloodlineNode(sourceNode) && isBloodlineNode(targetNode)) {
      return {
        isValid: false,
        message: t.ui.editor.validationMessages.bloodlineToBloodlinePartner
      };
    }
  }

  // Check parent handle restrictions for partner nodes
  if (sourceNode.type === 'person' && !isBloodlineNode(sourceNode) && sourceHandle === 'parent') {
    return {
      isValid: false,
      message: t.ui.editor.validationMessages.partnerNodeParentHandle.replace('{name}', sourceNode.data.name)
    };
  }

  if (targetNode.type === 'person' && !isBloodlineNode(targetNode) && targetHandle === 'parent') {
    return {
      isValid: false,
      message: t.ui.editor.validationMessages.partnerNodeParentHandle.replace('{name}', targetNode.data.name)
    };
  }

  // Check parent handle restrictions for bloodline nodes with multiple connections
  if (sourceNode.type === 'person' && isBloodlineNode(sourceNode) && sourceHandle === 'parent') {
    const parentConnectionCount = countParentConnections(sourceNode);
    if (parentConnectionCount >= 1) {
      return {
        isValid: false,
        message: t.ui.editor.validationMessages.bloodlineMultipleParents
          .replace('{name}', sourceNode.data.name)
          .replace('{count}', parentConnectionCount.toString())
      };
    }
  }

  if (targetNode.type === 'person' && isBloodlineNode(targetNode) && targetHandle === 'parent') {
    const parentConnectionCount = countParentConnections(targetNode);
    if (parentConnectionCount >= 1) {
      return {
        isValid: false,
        message: t.ui.editor.validationMessages.bloodlineMultipleParents
          .replace('{name}', targetNode.data.name)
          .replace('{count}', parentConnectionCount.toString())
      };
    }
  }

  return { isValid: true, message: null };
};
