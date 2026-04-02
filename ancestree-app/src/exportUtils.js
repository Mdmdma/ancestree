import JSZip from 'jszip';
import { encryptedApi } from './encryptedApi';
import { api } from './api';

/**
 * Convert blob to PNG using canvas with optional metadata
 * @param {Blob} blob - Image blob
 * @param {Object} metadata - Optional metadata to embed (description, taggedPeople, uploadDate)
 * @returns {Promise<Blob>} - PNG blob with embedded metadata
 */
async function convertBlobToPng(blob, metadata = null) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = async () => {
      try {
        // Create canvas with image dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.width || img.naturalWidth;
        canvas.height = img.height || img.naturalHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw the image
        ctx.drawImage(img, 0, 0);
        
        // Clean up object URL
        URL.revokeObjectURL(url);
        
        // Convert to PNG blob
        canvas.toBlob(async (pngBlob) => {
          if (!pngBlob) {
            reject(new Error('Failed to convert to PNG'));
            return;
          }
          
          try {
            // If metadata provided, embed it into the PNG
            if (metadata) {
              const pngData = await pngBlob.arrayBuffer();
              const modifiedPng = insertPngMetadata(pngData, metadata);
              const finalBlob = new Blob([modifiedPng], { type: 'image/png' });
              resolve(finalBlob);
            } else {
              resolve(pngBlob);
            }
          } catch (error) {
            reject(error);
          }
        }, 'image/png');
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Calculate CRC32 checksum for PNG chunks
 * @param {Uint8Array} data - Data to calculate CRC for
 * @returns {number} - CRC32 checksum
 */
function crc32(data) {
  let crc = -1;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    crc = crc ^ byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Create a PNG tEXt chunk
 * @param {string} keyword - Chunk keyword (max 79 chars, Latin-1)
 * @param {string} text - Text content (Latin-1)
 * @returns {Uint8Array} - Complete PNG chunk
 */
function createTextChunk(keyword, text) {
  // Encode keyword and text as Latin-1
  const keywordBytes = new TextEncoder().encode(keyword.substring(0, 79));
  const textBytes = new TextEncoder().encode(text);
  
  // Calculate chunk data length (keyword + null separator + text)
  const dataLength = keywordBytes.length + 1 + textBytes.length;
  
  // Create chunk: length (4) + type (4) + data + crc (4)
  const chunk = new Uint8Array(4 + 4 + dataLength + 4);
  const view = new DataView(chunk.buffer);
  
  // Write length (big endian)
  view.setUint32(0, dataLength, false);
  
  // Write chunk type "tEXt"
  chunk[4] = 0x74; // t
  chunk[5] = 0x45; // E
  chunk[6] = 0x58; // X
  chunk[7] = 0x74; // t
  
  // Write keyword
  chunk.set(keywordBytes, 8);
  
  // Write null separator
  chunk[8 + keywordBytes.length] = 0;
  
  // Write text
  chunk.set(textBytes, 8 + keywordBytes.length + 1);
  
  // Calculate and write CRC (chunk type + data)
  const crcData = chunk.slice(4, 4 + 4 + dataLength);
  const crc = crc32(crcData);
  view.setUint32(4 + 4 + dataLength, crc, false);
  
  return chunk;
}

/**
 * Insert metadata chunks into PNG file
 * @param {ArrayBuffer} pngData - Original PNG data
 * @param {Object} metadata - Metadata to embed
 * @returns {Uint8Array} - Modified PNG data with metadata
 */
function insertPngMetadata(pngData, metadata) {
  const png = new Uint8Array(pngData);
  
  // PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // Verify PNG signature
  for (let i = 0; i < 8; i++) {
    if (png[i] !== signature[i]) {
      throw new Error('Invalid PNG file');
    }
  }
  
  // Find IDAT chunk position (we'll insert metadata before it)
  let idatPos = 8; // Start after signature
  while (idatPos < png.length) {
    const view = new DataView(png.buffer, png.byteOffset + idatPos);
    const chunkLength = view.getUint32(0, false);
    const chunkType = String.fromCharCode(
      png[idatPos + 4],
      png[idatPos + 5],
      png[idatPos + 6],
      png[idatPos + 7]
    );
    
    if (chunkType === 'IDAT') {
      break;
    }
    
    // Move to next chunk
    idatPos += 4 + 4 + chunkLength + 4; // length + type + data + crc
  }
  
  // Create metadata chunks
  const chunks = [];
  
  // Use the description directly if provided
  if (metadata.description) {
    chunks.push(createTextChunk('Description', metadata.description));
  }
  
  if (metadata.uploadDate) {
    chunks.push(createTextChunk('Upload Date', new Date(metadata.uploadDate).toISOString()));
  }
  
  // Calculate total metadata size
  let metadataSize = 0;
  for (const chunk of chunks) {
    metadataSize += chunk.length;
  }
  
  // Create new PNG with metadata inserted
  const newPng = new Uint8Array(png.length + metadataSize);
  
  // Copy everything up to IDAT
  newPng.set(png.slice(0, idatPos), 0);
  
  // Insert metadata chunks
  let offset = idatPos;
  for (const chunk of chunks) {
    newPng.set(chunk, offset);
    offset += chunk.length;
  }
  
  // Copy rest of PNG (IDAT and beyond)
  newPng.set(png.slice(idatPos), offset);
  
  return newPng;
}

/**
 * Extract metadata from PNG file
 * @param {ArrayBuffer} pngData - PNG file data
 * @returns {Object|null} - Extracted metadata with description field, or null if no metadata found
 */
function extractPngMetadata(pngData) {
  const png = new Uint8Array(pngData);
  
  // PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // Verify PNG signature
  for (let i = 0; i < 8; i++) {
    if (png[i] !== signature[i]) {
      return null; // Not a valid PNG
    }
  }
  
  const metadata = {};
  let pos = 8; // Start after signature
  
  // Iterate through chunks
  while (pos < png.length - 12) { // Need at least 12 bytes for chunk header
    const view = new DataView(png.buffer, png.byteOffset + pos);
    const chunkLength = view.getUint32(0, false);
    
    // Prevent infinite loop on corrupted files
    if (chunkLength > png.length - pos || chunkLength < 0) {
      break;
    }
    
    const chunkType = String.fromCharCode(
      png[pos + 4],
      png[pos + 5],
      png[pos + 6],
      png[pos + 7]
    );
    
    // Stop at IEND chunk
    if (chunkType === 'IEND') {
      break;
    }
    
    // Extract tEXt chunks
    if (chunkType === 'tEXt') {
      const chunkData = png.slice(pos + 8, pos + 8 + chunkLength);
      
      // Find null separator between keyword and text
      let nullPos = -1;
      for (let i = 0; i < chunkData.length; i++) {
        if (chunkData[i] === 0) {
          nullPos = i;
          break;
        }
      }
      
      if (nullPos !== -1) {
        const keyword = new TextDecoder('latin1').decode(chunkData.slice(0, nullPos));
        const text = new TextDecoder('utf-8').decode(chunkData.slice(nullPos + 1));
        
        // Store description
        if (keyword === 'Description') {
          metadata.description = text;
        } else if (keyword === 'Upload Date') {
          metadata.uploadDate = text;
        }
      }
    }
    
    // Move to next chunk (length + type + data + crc)
    pos += 4 + 4 + chunkLength + 4;
  }
  
  return Object.keys(metadata).length > 0 ? metadata : null;
}

/**
 * Extract metadata from JPEG file
 * @param {ArrayBuffer} jpegData - JPEG file data
 * @returns {Object|null} - Extracted metadata with description field, or null if no metadata found
 */
function extractJpegMetadata(jpegData) {
  const data = new Uint8Array(jpegData);
  
  // JPEG starts with FFD8
  if (data[0] !== 0xFF || data[1] !== 0xD8) {
    return null; // Not a valid JPEG
  }
  
  const metadata = {};
  let pos = 2;
  
  // Scan for APP1 marker (EXIF data)
  while (pos < data.length - 4) {
    if (data[pos] !== 0xFF) {
      break;
    }
    
    const marker = data[pos + 1];
    
    // APP1 marker (EXIF)
    if (marker === 0xE1) {
      const segmentLength = (data[pos + 2] << 8) | data[pos + 3];
      const segmentData = data.slice(pos + 4, pos + 2 + segmentLength);
      
      // Check for EXIF header
      const exifHeader = String.fromCharCode(...segmentData.slice(0, 4));
      if (exifHeader === 'Exif') {
        // Try to extract description from EXIF
        // EXIF uses TIFF format - look for ImageDescription tag (0x010E)
        const exifData = segmentData.slice(6); // Skip "Exif\0\0"
        
        // Simple scan for ImageDescription tag (not full EXIF parser)
        // This is a simplified approach - real EXIF parsing is complex
        const description = extractExifDescription(exifData);
        if (description) {
          metadata.description = description;
        }
      }
      
      break; // Only process first APP1 segment
    }
    
    // Move to next marker
    if (marker === 0xD8 || marker === 0xD9) {
      // SOI or EOI
      pos += 2;
    } else {
      // Other markers have length
      const segmentLength = (data[pos + 2] << 8) | data[pos + 3];
      pos += 2 + segmentLength;
    }
  }
  
  return Object.keys(metadata).length > 0 ? metadata : null;
}

/**
 * Extract ImageDescription from EXIF data (simplified)
 * @param {Uint8Array} exifData - EXIF data block
 * @returns {string|null} - Description or null
 */
function extractExifDescription(exifData) {
  try {
    // Determine byte order (MM or II)
    const byteOrder = String.fromCharCode(exifData[0], exifData[1]);
    const littleEndian = byteOrder === 'II';
    
    if (byteOrder !== 'II' && byteOrder !== 'MM') {
      return null;
    }
    
    const view = new DataView(exifData.buffer, exifData.byteOffset);
    
    // Skip TIFF header, get IFD0 offset
    const ifd0Offset = view.getUint32(4, littleEndian);
    
    if (ifd0Offset >= exifData.length) {
      return null;
    }
    
    // Read number of directory entries
    const numEntries = view.getUint16(ifd0Offset, littleEndian);
    
    // Scan IFD entries for ImageDescription (0x010E)
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifd0Offset + 2 + (i * 12);
      
      if (entryOffset + 12 > exifData.length) {
        break;
      }
      
      const tag = view.getUint16(entryOffset, littleEndian);
      
      // ImageDescription tag (0x010E = 270)
      if (tag === 0x010E) {
        const type = view.getUint16(entryOffset + 2, littleEndian);
        const count = view.getUint32(entryOffset + 4, littleEndian);
        
        // Type 2 = ASCII string
        if (type === 2 && count > 0) {
          let valueOffset;
          
          // If count <= 4, value is stored inline
          if (count <= 4) {
            valueOffset = entryOffset + 8;
          } else {
            // Value is stored at offset
            valueOffset = view.getUint32(entryOffset + 8, littleEndian);
          }
          
          if (valueOffset + count <= exifData.length) {
            const descBytes = exifData.slice(valueOffset, valueOffset + count - 1); // Exclude null terminator
            return new TextDecoder('utf-8').decode(descBytes);
          }
        }
        
        break;
      }
    }
  } catch (error) {
    console.warn('Error extracting EXIF description:', error);
  }
  
  return null;
}

/**
 * Extract description from image file
 * @param {File} file - Image file
 * @returns {Promise<string|null>} - Description from metadata, or null if not found
 */
export async function extractImageDescription(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    if (file.type === 'image/png') {
      const metadata = extractPngMetadata(arrayBuffer);
      return metadata?.description || null;
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      const metadata = extractJpegMetadata(arrayBuffer);
      return metadata?.description || null;
    }
    
    return null;
  } catch (error) {
    console.warn('Error extracting image description:', error);
    return null;
  }
}

/**
 * Convert an image to PNG format with metadata embedded
 * @param {HTMLImageElement} img - Loaded image element
 * @param {Object} metadata - Metadata to embed (description, tagged people)
 * @returns {Promise<Blob>} - PNG Blob with metadata
 */
async function convertImageToPngWithMetadata(img, metadata) {
  return new Promise((resolve, reject) => {
    try {
      // Create canvas with image dimensions
      const canvas = document.createElement('canvas');
      canvas.width = img.width || img.naturalWidth;
      canvas.height = img.height || img.naturalHeight;
      const ctx = canvas.getContext('2d');
      
      // Draw the image
      ctx.drawImage(img, 0, 0);
      
      // Convert to PNG blob
      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) {
          reject(new Error('Failed to convert image to PNG'));
          return;
        }
        
        try {
          // Read PNG as ArrayBuffer
          const pngData = await pngBlob.arrayBuffer();
          
          // Insert metadata chunks
          const modifiedPng = insertPngMetadata(pngData, metadata);
          
          // Create final blob
          const finalBlob = new Blob([modifiedPng], { type: 'image/png' });
          
          resolve(finalBlob);
        } catch (error) {
          reject(error);
        }
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create a metadata text file for an image
 * @param {Object} metadata - Metadata object
 * @returns {string} - Formatted metadata text
 */
function createMetadataText(metadata) {
  let text = '';
  
  if (metadata.description) {
    text += `Beschreibung: ${metadata.description}\n`;
  }
  
  if (metadata.uploaded_at) {
    text += `Hochgeladen am: ${new Date(metadata.uploaded_at).toLocaleString('de-DE')}\n`;
  }
  
  if (metadata.uploaded_by) {
    text += `Hochgeladen von: ${metadata.uploaded_by}\n`;
  }
  
  if (metadata.taggedPeople && metadata.taggedPeople.length > 0) {
    text += `\nMarkierte Personen:\n`;
    metadata.taggedPeople.forEach(person => {
      text += `  - ${person.name || ''} ${person.surname || ''}\n`;
    });
  }
  
  return text;
}

/**
 * Convert nodes array to CSV with all human-readable fields
 * @param {Array} nodes - Array of node objects
 * @returns {string} - CSV string
 */
function nodesToCsv(nodes) {
  // Filter for only "person" type nodes
  const personNodes = nodes.filter(node => {
    const type = node.type || node.data?.type;
    return type === 'person';
  });
  
  // Define CSV headers (all human-readable fields including coordinates)
  const headers = [
    'Name',
    'Nachname',
    'Mädchenname',
    'Geburtsdatum',
    'Sterbedatum',
    'Straße',
    'Hausnummer',
    'Stadt',
    'PLZ',
    'Land',
    'Telefon',
    'E-Mail',
    'Breitengrad',
    'Längengrad'
  ];
  
  // Helper function to escape CSV values
  const escapeCsv = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Create CSV rows
  const rows = personNodes.map(node => {
    const data = node.data || node;
    return [
      escapeCsv(data.name),
      escapeCsv(data.surname),
      escapeCsv(data.maidenName || data.maiden_name),
      escapeCsv(data.birthDate || data.birth_date),
      escapeCsv(data.deathDate || data.death_date),
      escapeCsv(data.street),
      escapeCsv(data.housenumber),
      escapeCsv(data.city),
      escapeCsv(data.zip),
      escapeCsv(data.country),
      escapeCsv(data.phone),
      escapeCsv(data.email),
      escapeCsv(data.latitude),
      escapeCsv(data.longitude)
    ].join(',');
  });
  
  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export all family data to a ZIP file with separate metadata files
 * @param {Function} onProgress - Progress callback (percent, message)
 * @param {string} familyName - Name of the family for file naming
 * @returns {Promise<void>}
 */
export async function exportFamilyDataWithMetadata(onProgress, familyName = 'family') {
  try {
    const zip = new JSZip();
    
    // Step 1: Load all nodes (decrypted if encryption is enabled)
    onProgress(10, 'Lade Personendaten...');
    const nodes = await encryptedApi.loadNodes();
    
    if (!nodes || nodes.length === 0) {
      throw new Error('Keine Personendaten zum Exportieren gefunden.');
    }
    
    // Create a map of person IDs to person data for easy lookup
    const personMap = new Map();
    nodes.forEach(node => {
      if (node.id) {
        personMap.set(node.id, {
          name: node.data?.name || '',
          surname: node.data?.surname || ''
        });
      }
    });
    
    // Step 2: Create CSV from nodes
    onProgress(20, 'Erstelle CSV-Datei...');
    const csv = nodesToCsv(nodes);
    zip.file('personen.csv', csv);
    
    // Step 3: Load all images (decrypted if encryption is enabled)
    onProgress(30, 'Lade Bildmetadaten...');
    const images = await encryptedApi.loadImages();
    
    if (images && images.length > 0) {
      // Create images folder in ZIP
      const imagesFolder = zip.folder('bilder');
      
      // Step 4: Process each image
      const totalImages = images.length;
      // Sanitize family name for filename
      const safeFamilyName = familyName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const imageNumber = i + 1; // 1-based numbering
        const progress = 30 + ((i / totalImages) * 60); // 30% to 90%
        onProgress(progress, `Lade Bild ${imageNumber} von ${totalImages}...`);
        
        try {
          // Use s3Key for proxy (preferred) or s3Url for backwards compatibility
          // s3Key is decrypted by encryptedApi.loadImages()
          const imageKeyOrUrl = image.s3Key || image.s3Url || image.url;
          
          if (!imageKeyOrUrl) {
            console.warn(`Skipping image ${image.id}: no s3Key or URL found`);
            continue;
          }
          
          console.log(`[Export] Fetching image ${image.id} via proxy...`);
          
          // Fetch image via backend proxy (solves CORS issues)
          // The proxy accepts either s3Key or s3Url
          const imageBlob = await api.fetchImageViaProxy(imageKeyOrUrl);
          
          console.log(`[Export] Converting image ${image.id} to PNG with metadata...`);
          
          // Build tagged people list with actual names from personMap
          const taggedPeople = [];
          if (image.people && Array.isArray(image.people)) {
            for (const taggedPerson of image.people) {
              const personId = taggedPerson.personId || taggedPerson.person_id;
              if (personId && personMap.has(personId)) {
                const person = personMap.get(personId);
                const fullName = `${person.name} ${person.surname}`.trim();
                if (fullName) {
                  taggedPeople.push(fullName);
                }
              }
            }
          }
          
          // Build description text with all metadata
          let descriptionText = `Datei: family_${safeFamilyName}_image_${imageNumber}.png\n`;
          descriptionText += `Bild-ID: ${image.id}\n`;
          descriptionText += `Bildnummer: ${imageNumber}\n`;
          descriptionText += `\n`;
          
          if (image.description) {
            descriptionText += `Beschreibung:\n${image.description}\n\n`;
          }
          
          if (taggedPeople.length > 0) {
            descriptionText += `Markierte Personen:\n`;
            taggedPeople.forEach(name => {
              descriptionText += `  - ${name}\n`;
            });
            descriptionText += `\n`;
          }
          
          if (image.uploadDate || image.upload_date) {
            const date = new Date(image.uploadDate || image.upload_date);
            descriptionText += `Hochgeladen am: ${date.toLocaleString('de-DE')}\n`;
          }
          
          // Prepare metadata object for PNG embedding
          const metadata = {
            description: descriptionText,
            taggedPeople: taggedPeople.map(name => ({ name })),
            uploadDate: image.uploadDate || image.upload_date
          };
          
          // Convert to PNG with embedded metadata
          const pngBlob = await convertBlobToPng(imageBlob, metadata);
          
          // Create safe filename with family name and image number
          const safeFilename = `family_${safeFamilyName}_image_${imageNumber}.png`;
          
          // Add image to ZIP
          imagesFolder.file(safeFilename, pngBlob);
          
          console.log(`[Export] Successfully processed image ${image.id} with embedded metadata`);
          
        } catch (imgError) {
          console.error(`Failed to process image ${image.id}:`, imgError);
          // Continue with next image
        }
      }
    }
    
    // Step 5: Generate ZIP file
    onProgress(95, 'Erstelle ZIP-Datei...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Step 6: Download ZIP file
    onProgress(100, 'Download wird gestartet...');
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `familienbaum_export_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

/**
 * Export all family data to a ZIP file
 * @param {Function} onProgress - Progress callback (percent, message)
 * @returns {Promise<void>}
 */
export async function exportFamilyData(onProgress) {
  try {
    const zip = new JSZip();
    
    // Step 1: Load all nodes (decrypted if encryption is enabled)
    onProgress(10, 'Lade Personendaten...');
    const nodes = await encryptedApi.loadNodes();
    
    // Create a map of person IDs to person data for easy lookup
    const personMap = new Map();
    nodes.forEach(node => {
      if (node.id) {
        personMap.set(node.id, {
          name: node.data?.name || node.name || '',
          surname: node.data?.surname || node.surname || ''
        });
      }
    });
    
    // Step 2: Create CSV from nodes
    onProgress(20, 'Erstelle CSV-Datei...');
    const csv = nodesToCsv(nodes);
    zip.file('personen.csv', csv);
    
    // Step 3: Load all images (decrypted if encryption is enabled)
    onProgress(30, 'Lade Bilder...');
    const images = await encryptedApi.loadImages();
    
    if (images && images.length > 0) {
      // Create images folder in ZIP
      const imagesFolder = zip.folder('bilder');
      
      // Step 4: Process each image
      const totalImages = images.length;
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const progress = 30 + ((i / totalImages) * 60); // 30% to 90%
        onProgress(progress, `Verarbeite Bild ${i + 1} von ${totalImages}...`);
        
        try {
          // Use s3Url (presigned URL from encryptedApi.loadImages) or s3Key for proxy fallback
          const imageUrl = image.s3Url || image.url;
          
          if (!imageUrl) {
            continue;
          }
          
          // Load image using Image element (works with presigned URLs)
          const img = await loadImageElement(imageUrl);
          
          // Build tagged people list with actual names from personMap
          const taggedPeople = [];
          if (image.tagged_people && Array.isArray(image.tagged_people)) {
            for (const taggedPerson of image.tagged_people) {
              const personId = taggedPerson.personId || taggedPerson.person_id;
              if (personId && personMap.has(personId)) {
                const person = personMap.get(personId);
                taggedPeople.push({
                  name: person.name,
                  surname: person.surname
                });
              }
            }
          }
          
          // Create metadata object
          const metadata = {
            description: image.description,
            uploaded_at: image.uploaded_at,
            uploaded_by: image.uploaded_by,
            taggedPeople: taggedPeople
          };
          
          // Convert image to PNG with embedded metadata
          const pngBlob = await convertImageToPngWithMetadata(img, metadata);
          
          // Create safe filename
          const safeFilename = `bild_${image.id}.png`;
          
          // Add image to ZIP
          imagesFolder.file(safeFilename, pngBlob);
        } catch (imgError) {
          // If PNG conversion fails, try to add the original image
          try {
            const imageUrl = image.s3Url || image.url;
            if (imageUrl) {
              // Load image again and try to get it as blob via canvas
              const img = await loadImageElement(imageUrl);
              const canvas = document.createElement('canvas');
              canvas.width = img.width || img.naturalWidth;
              canvas.height = img.height || img.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              
              // Get original format if possible
              const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
              });
              
              if (blob) {
                imagesFolder.file(`bild_${image.id}.png`, blob);
              }
            }
          } catch (fallbackError) {
            // Really failed - skip this image
          }
        }
      }
    }
    
    // Step 5: Generate ZIP file
    onProgress(95, 'Erstelle ZIP-Datei...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Step 6: Download ZIP file
    onProgress(100, 'Download wird gestartet...');
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `familienbaum_export_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}
