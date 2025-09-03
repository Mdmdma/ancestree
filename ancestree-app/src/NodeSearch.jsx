import React, { useState, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';

const NodeSearch = ({ nodes, onNodeSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelectingNode, setIsSelectingNode] = useState(false);
  const { fitView } = useReactFlow();
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Search function that filters nodes by name and sorts by relevance
  const searchNodes = (term) => {
    if (!term.trim() || !nodes || nodes.length === 0) {
      setSearchResults([]);
      setIsDropdownVisible(false);
      return;
    }

    const termLower = term.toLowerCase().trim();
    const termWords = termLower.split(/\s+/);

    const filtered = nodes
      .filter(node => {
        if (!node || !node.data) return false;
        const name = (node.data.name || '').toLowerCase();
        const surname = (node.data.surname || '').toLowerCase();
        const fullName = `${name} ${surname}`.trim();
        
        // Check if all search terms are found in the name
        return termWords.every(word => 
          name.includes(word) || surname.includes(word) || fullName.includes(word)
        );
      })
      .sort((a, b) => {
        // Calculate relevance scores for better sorting
        const aName = (a.data.name || '').toLowerCase();
        const aSurname = (a.data.surname || '').toLowerCase();
        const aFullName = `${aName} ${aSurname}`.trim();
        
        const bName = (b.data.name || '').toLowerCase();
        const bSurname = (b.data.surname || '').toLowerCase();
        const bFullName = `${bName} ${bSurname}`.trim();
        
        // Exact match gets highest priority
        const aExactMatch = aFullName === termLower;
        const bExactMatch = bFullName === termLower;
        
        if (aExactMatch && !bExactMatch) return -1;
        if (bExactMatch && !aExactMatch) return 1;
        
        // Starts with search term gets second priority
        const aStartsWith = aFullName.startsWith(termLower) || aName.startsWith(termLower) || aSurname.startsWith(termLower);
        const bStartsWith = bFullName.startsWith(termLower) || bName.startsWith(termLower) || bSurname.startsWith(termLower);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (bStartsWith && !aStartsWith) return 1;
        
        // Then sort by birth date (older first)
        const aDate = a.data.birthDate || a.data.birth_date;
        const bDate = b.data.birthDate || b.data.birth_date;
        
        if (!aDate && !bDate) return aFullName.localeCompare(bFullName);
        if (!aDate) return 1;
        if (!bDate) return -1;
        
        try {
          return new Date(aDate) - new Date(bDate);
        } catch {
          return aFullName.localeCompare(bFullName);
        }
      });

    // Store total count and limit results to avoid overwhelming the user
    const totalResults = filtered.length;
    const limitedResults = filtered.slice(0, 8);
    
    // Store both limited results and total count for display
    setSearchResults({ 
      results: limitedResults, 
      total: totalResults, 
      hasMore: totalResults > 8 
    });
    setIsDropdownVisible(limitedResults.length > 0);
    setSelectedIndex(-1);
  };

  // Handle search input changes with debounce
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!value.trim()) {
      setSearchResults({ results: [], total: 0, hasMore: false });
      setIsDropdownVisible(false);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    
    // Debounce search with shorter delay for better responsiveness
    searchTimeoutRef.current = setTimeout(() => {
      searchNodes(value);
      setIsSearching(false);
    }, 100);
  };

  // Clear search
  const clearSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchTerm('');
    setSearchResults({ results: [], total: 0, hasMore: false });
    setIsDropdownVisible(false);
    setSelectedIndex(-1);
    setIsSearching(false);
    searchInputRef.current?.focus();
  };

  // Handle node selection
  const handleNodeSelect = (node) => {
    setIsSelectingNode(true);
    setSearchTerm('');
    setSearchResults([]);
    setIsDropdownVisible(false);
    setSelectedIndex(-1);
    
    // Always select the node regardless of active tab
    // This ensures the node is properly selected in the tree
    onNodeSelect(node);
    
    // Center the view on the selected node with a slight delay for better UX
    setTimeout(() => {
      fitView({
        nodes: [node],
        padding: 0.3,
        duration: 800,
        maxZoom: 1.5
      });
      
      // Reset selecting state after animation
      setTimeout(() => {
        setIsSelectingNode(false);
      }, 800);
    }, 100);
  };

  // Helper function to highlight search terms in text
  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm.trim() || !text) return text;
    
    const termWords = searchTerm.toLowerCase().trim().split(/\s+/);
    let highlightedText = text;
    
    termWords.forEach(word => {
      if (word.length > 1) { // Only highlight words longer than 1 character
        const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
      }
    });
    
    return highlightedText;
  };
  const handleKeyDown = (e) => {
    if (!isDropdownVisible || !searchResults.results || searchResults.results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.results.length) {
          handleNodeSelect(searchResults.results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsDropdownVisible(false);
        setSelectedIndex(-1);
        searchInputRef.current?.blur();
        break;
    }
  };

  // Format birth date for display
  const formatBirthDate = (birthDate) => {
    // Handle both birthDate and birth_date field names
    const date = birthDate || '';
    if (!date) return '';
    
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return date; // Return original if invalid
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        !searchInputRef.current?.contains(event.target)
      ) {
        setIsDropdownVisible(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Clean up timeout on unmount
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <style>
        {`
          .search-highlight mark {
            background-color: #ffeb3b;
            color: #333;
            padding: 1px 2px;
            border-radius: 2px;
            font-weight: bold;
          }
        `}
      </style>
      <div style={{ position: 'relative' }}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder={isSelectingNode ? "Navigating to person..." : "Search people..."}
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searchResults.results && searchResults.results.length > 0) {
              setIsDropdownVisible(true);
            }
          }}
          disabled={isSelectingNode}
          style={{
            width: '100%',
            padding: '12px 40px 12px 40px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '6px',
            backgroundColor: isSelectingNode ? 'var(--search-selecting-bg, #f0f8ff)' : 'var(--search-bg, #ffffff)',
            color: isSelectingNode ? 'var(--search-selecting-text, #666666)' : 'var(--search-text, #333333)',
            boxSizing: 'border-box',
            outline: 'none',
            transition: 'border-color 0.2s ease, background-color 0.2s ease',
            cursor: isSelectingNode ? 'wait' : 'text'
          }}
        />
        <div style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--search-icon, #666666)',
          pointerEvents: 'none',
          fontSize: '16px'
        }}>
          {isSelectingNode ? '⏳' : '🔍'}
        </div>
        {searchTerm && (
          <button
            onClick={clearSearch}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--search-icon, #666666)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'var(--search-hover, #f0f0f0)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        )}
      </div>

      {(isDropdownVisible && ((searchResults.results && searchResults.results.length > 0) || (searchTerm.trim() && !isSearching))) || isSearching ? (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--search-dropdown-bg, #ffffff)',
            border: '1px solid #ccc',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          {isSearching ? (
            <div style={{
              padding: '12px',
              color: 'var(--search-text-muted, #666666)',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              Searching...
            </div>
          ) : (!searchResults.results || searchResults.results.length === 0) && searchTerm.trim() ? (
            <div style={{
              padding: '12px',
              color: 'var(--search-text-muted, #666666)',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              No people found matching "{searchTerm}"
            </div>
          ) : (
            <>
              {searchResults.total > 1 && (
                <div style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: 'var(--search-text-muted, #666666)',
                  backgroundColor: 'var(--search-header-bg, #f8f9fa)',
                  borderBottom: '1px solid #eee'
                }}>
                  {searchResults.hasMore 
                    ? `Showing 8 of ${searchResults.total} people found`
                    : `${searchResults.total} people found`
                  }
                </div>
              )}
              {searchResults.results && searchResults.results.map((node, index) => {
                const name = node.data?.name || '';
                const surname = node.data?.surname || '';
                const fullName = `${name} ${surname}`.trim();
                const birthDate = formatBirthDate(node.data?.birthDate || node.data?.birth_date);
                
                return (
                  <div
                    key={node.id}
                    onClick={() => handleNodeSelect(node)}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      backgroundColor: index === selectedIndex ? 'var(--search-selected-bg, #f0f8ff)' : 'var(--search-dropdown-bg, #ffffff)',
                      borderBottom: index < searchResults.results.length - 1 ? '1px solid #eee' : 'none',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div 
                      className="search-highlight"
                      style={{
                        fontWeight: '500',
                        fontSize: '14px',
                        color: 'var(--search-text, #333333)',
                        marginBottom: birthDate ? '4px' : '0'
                      }}
                      dangerouslySetInnerHTML={{
                        __html: highlightSearchTerm(fullName || 'Unnamed Person', searchTerm)
                      }}
                    />
                    {birthDate && (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--search-text-muted, #666666)'
                      }}>
                        Born: {birthDate}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NodeSearch;
