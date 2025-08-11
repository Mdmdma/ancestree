# Performance Optimizations Applied to Ancestree App

This document outlines all the performance optimizations implemented to resolve the reported performance issues:
- `[Violation] 'message' handler took <N>ms`
- `[Violation] Forced reflow while executing JavaScript took 52ms`  
- `[Violation] 'click' handler took <N>ms`
- `[Violation] 'setTimeout' handler took 4697ms`

## 1. Enhanced Performance Utilities (`performanceUtils.js`)

### New Utilities Added:
- **`createBatchedUpdater`**: Batches state updates using React's automatic batching with `requestAnimationFrame`
- **`arrayUtils.fastMap`**: Optimized array mapping that reuses arrays when no changes are detected
- **`arrayUtils.interruptibleForEach`**: Large array processing with interruption to prevent blocking
- **`perfMonitor`**: Performance measurement utilities for debugging
- **`createDatabaseDebouncer`**: Specialized debouncer for database operations with per-ID tracking
- **Enhanced memoization**: Added cache size limits to prevent memory leaks

## 2. State Management Optimizations

### Batched Updates:
- Replaced direct `setNodes`/`setEdges` calls with `batchedNodeUpdater`/`batchedEdgeUpdater`
- Prevents multiple re-renders from rapid state changes
- Uses `requestAnimationFrame` for optimal timing

### Optimized Array Operations:
- `fastMap` only creates new arrays when changes are detected
- Reduced unnecessary object creation and garbage collection
- Optimized selection state management

## 3. Database Operation Optimizations

### Debounced Database Calls:
- Position updates are now debounced (300ms) to prevent excessive API calls during dragging
- Per-node debouncing ensures each node's updates are independent
- Reduced database load significantly

### Batch Processing:
- Edge and node deletions are processed in batches (5 items at a time)
- API calls are spread across time (25-50ms delays) to prevent blocking
- Error handling for individual batch items

## 4. React Flow Specific Optimizations

### Node/Edge Change Handlers:
- `handleNodesChange`: Uses batched processing for position updates and deletions
- `handleEdgesChange`: Batched edge deletion processing
- Separated synchronous UI updates from asynchronous database operations

### Connection Handlers:
- `onConnect`: Optimized partner connection logic with batch processing
- `onNodeClick`/`onPaneClick`: Use optimized array operations for selection state
- `onConnectEnd`: Deferred heavy operations using `requestAnimationFrame`

## 5. Auto Layout Performance

### ELK.js Optimizations:
- Wrapped layout calculations in performance monitoring
- Used `deferToNextFrame` to prevent blocking the main thread
- Memoized expensive calculations (Y position calculations)
- Batched database updates for position changes

### Memory Management:
- Added performance monitoring to identify bottlenecks
- Optimized partner count calculations
- Reduced redundant array operations

## 6. Click Handler Optimizations

### Event Handler Performance:
- Debounced and throttled event handlers
- Optimized node selection logic
- Reduced DOM queries and updates
- Batch state updates for selection changes

## 7. Asynchronous Processing

### Non-blocking Operations:
- Heavy computations deferred to next animation frame
- Database operations processed in small batches
- Prevented main thread blocking during large operations

### Error Handling:
- Graceful degradation when batch operations fail
- Individual error handling for batch items
- Maintained app stability during performance optimization

## 8. Memory Optimization

### Cache Management:
- Limited memoization cache sizes
- Automatic cache cleanup to prevent memory leaks
- Optimized object creation and reuse

### Garbage Collection:
- Reduced unnecessary object creation
- Reused arrays and objects where possible
- Optimized dependency arrays in useCallback hooks

## Expected Performance Improvements

1. **Reduced Handler Execution Time**: Batch processing and debouncing should significantly reduce handler execution times
2. **Eliminated Forced Reflows**: Deferred DOM operations prevent synchronous layout thrashing
3. **Faster Click Response**: Optimized selection logic and batch updates improve click responsiveness
4. **Reduced setTimeout Violations**: Batch processing with delays prevents long-running operations

## Monitoring and Debugging

Performance monitoring utilities are now available:
- `perfMonitor.measure()` and `perfMonitor.measureAsync()` for tracking operation times
- Debug mode shows detailed performance information
- Console logging for performance-critical operations

## Usage

All optimizations are transparent to existing functionality. The app maintains the same user experience while providing significantly better performance, especially with:
- Large family trees (100+ nodes)
- Frequent dragging/repositioning operations
- Auto-layout calculations
- Multiple rapid clicks/selections

## Testing

To test the performance improvements:
1. Open browser developer tools
2. Monitor the Console for performance violations
3. Use large datasets with many nodes and connections
4. Perform rapid interactions (clicking, dragging, auto-layout)
5. Compare violation messages before and after optimizations
