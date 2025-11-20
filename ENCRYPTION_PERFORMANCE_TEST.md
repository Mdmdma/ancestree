# Encryption Performance Testing

## Overview

This document describes the encryption performance testing tool added to Ancestree to evaluate the feasibility of encrypting every field in the database separately with padding.

## Purpose

The performance test helps answer critical questions:
- Is field-level encryption with padding feasible for production use?
- What is the performance overhead of encrypting all database fields?
- How does encryption scale with different tree sizes?
- What is the storage overhead of padded encrypted data?

## Accessing the Test

1. Navigate to the Admin Panel in your Ancestree instance
2. Authenticate with your admin password
3. Select the **🧪 Test** tab from the side menu
4. Configure and run the performance test

## Test Configuration

### Parameters

- **Number of Fields** (1,000 - 20,000)
  - Simulates encryption of database fields
  - Default: 10,000 fields
  - Typical tree: 750-3,000 fields
  - Large tree: 5,000-15,000 fields

- **Test Folds** (3 - 20)
  - Number of complete test iterations
  - Default: 10 folds
  - More folds = more reliable statistics

- **Use Padding** (Recommended: ON)
  - Pads all values to 256 characters
  - Hides actual data length for security
  - Tests worst-case performance scenario

## Understanding Results

### Key Metrics

1. **Overall Performance**
   - Total time per fold
   - Helps estimate real-world delays

2. **Encryption Performance**
   - Time to encrypt all fields
   - Fields encrypted per second
   - Average time per field

3. **Decryption Performance**
   - Time to decrypt all fields
   - Fields decrypted per second
   - Average time per field

4. **Data Size Impact**
   - Original data size
   - Encrypted data size (with padding)
   - Storage overhead percentage

5. **Feasibility Assessment**
   - Automatic evaluation based on results
   - Estimates impact on typical tree load

## Interpreting Feasibility

The test provides an automated assessment:

- **✓ HIGHLY FEASIBLE** (< 100ms for typical load)
  - No noticeable user impact
  - Safe to implement field-level encryption

- **⚠ FEASIBLE** (100-500ms for typical load)
  - Minor delay that most users won't notice
  - Acceptable for most use cases

- **⚠ MARGINALLY FEASIBLE** (500-2000ms for typical load)
  - Noticeable delay during load operations
  - Consider optimization or selective encryption

- **✗ NOT RECOMMENDED** (> 2000ms for typical load)
  - Significant performance impact
  - Field-level encryption may not be suitable

## What the Test Does

1. **Generates realistic test data**
   - Simulates various database field types
   - Creates fields of different lengths
   - Includes empty fields and long descriptions

2. **Applies padding** (if enabled)
   - Pads all values to 256 characters
   - Simulates worst-case storage scenario

3. **Runs encryption**
   - Uses Web Crypto API (AES-256-GCM)
   - Derives keys with PBKDF2 (100,000 iterations)
   - Generates random IVs for each field

4. **Runs decryption**
   - Decrypts all encrypted fields
   - Verifies data integrity

5. **Repeats for multiple folds**
   - Runs the complete cycle multiple times
   - Calculates statistical measures (mean, median, min, max)

6. **Generates comprehensive report**
   - Performance metrics
   - Storage impact
   - Feasibility assessment

## Database Field Estimates

### Typical Family Tree
- **Nodes**: 50-200 records × 15 encryptable fields
- **Edges**: 50-300 records × 2 encryptable fields
- **Images**: 0-500 records × 4 encryptable fields
- **Total**: ~750-3,000 fields

### Large/Detailed Tree
- **Nodes**: 200-500 records × 15 encryptable fields
- **Edges**: 300-1,000 records × 2 encryptable fields
- **Images**: 500-2,000 records × 4 encryptable fields
- **Total**: ~5,000-15,000 fields

## Technical Implementation

### Test Script Location
- Frontend: `ancestree-app/src/encryptionPerformanceTest.js`
- Admin Panel Integration: `ancestree-app/src/AdminPanel.jsx`

### Encryption Method
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **IV**: Random 96-bit (12 bytes) per field
- **Padding**: Null-terminated to 256 characters

### Performance Considerations
- Runs entirely in browser (Web Crypto API)
- Non-blocking with progress updates
- Memory efficient (processes in batches)
- Results exportable for analysis

## Using Test Results

### For Current Implementation
- Evaluate if existing encryption approach is optimal
- Identify performance bottlenecks
- Plan for scaling to larger trees

### For Future Implementation
- Decide between field-level vs record-level encryption
- Determine if padding is acceptable overhead
- Plan for lazy loading/caching strategies

### For Architecture Decisions
- Compare encryption performance across browsers
- Evaluate need for server-side encryption
- Consider hybrid approaches (encrypt sensitive fields only)

## Best Practices

1. **Run multiple tests**
   - Test with different configurations
   - Compare padded vs non-padded results
   - Test on different devices/browsers

2. **Export and analyze results**
   - Save results for comparison
   - Track performance over time
   - Share with team for review

3. **Consider real-world scenarios**
   - Test with actual tree size in mind
   - Factor in network latency
   - Consider concurrent operations

4. **Plan for growth**
   - Test with larger field counts
   - Estimate future tree sizes
   - Plan optimization strategies

## Limitations

- Simulates encryption in isolation
- Doesn't account for network latency
- Browser performance varies by device
- Single-threaded execution in JavaScript

## Next Steps

Based on test results, you can:

1. **If feasible**: Implement field-level encryption with confidence
2. **If marginal**: Consider selective field encryption or optimization
3. **If not feasible**: Explore alternative approaches (record-level, server-side, etc.)

## Support

For questions or issues with the performance test:
- Check browser console for detailed logs
- Export results and share for analysis
- Review existing encryption implementation in `encryptionUtils.js`
