import JSZip from 'jszip';
import { encryptedApi } from './encryptedApi';

/**
 * Load image using Image element (works with CORS, unlike fetch)
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<HTMLImageElement>} - Loaded image element
 */
async function loadImageElement(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Try to enable CORS
    
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If CORS fails, try without crossOrigin
      const img2 = new Image();
      img2.onload = () => resolve(img2);
      img2.onerror = () => reject(new Error('Failed to load image'));
      img2.src = imageUrl;
    };
    
    img.src = imageUrl;
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
  
  // Combine description and tagged people into a single Description field
  let descriptionText = '';
  
  if (metadata.description) {
    descriptionText = metadata.description;
  }
  
  if (metadata.taggedPeople && metadata.taggedPeople.length > 0) {
    const taggedNames = metadata.taggedPeople
      .map(p => `${p.name || ''} ${p.surname || ''}`.trim())
      .filter(name => name)
      .join(', ');
    
    if (taggedNames) {
      // Add tagged people on a new line after description
      if (descriptionText) {
        descriptionText += '\n' + taggedNames;
      } else {
        descriptionText = taggedNames;
      }
    }
  }
  
  if (descriptionText) {
    chunks.push(createTextChunk('Description', descriptionText));
  }
  
  if (metadata.uploaded_at) {
    chunks.push(createTextChunk('Upload Date', new Date(metadata.uploaded_at).toISOString()));
  }
  
  if (metadata.uploaded_by) {
    chunks.push(createTextChunk('Uploaded By', metadata.uploaded_by));
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
 * Convert nodes array to CSV
 * @param {Array} nodes - Array of node objects
 * @returns {string} - CSV string
 */
function nodesToCsv(nodes) {
  // Filter for only "person" type nodes
  const personNodes = nodes.filter(node => {
    const type = node.type || node.data?.type;
    return type === 'person';
  });
  
  // Define CSV headers (removed ID, Typ, Blutlinie, Position X, Position Y)
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
    'E-Mail'
  ];
  
  // Helper function to escape CSV values
  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Create CSV rows (removed ID, type, bloodline, position columns)
  const rows = personNodes.map(node => {
    return [
      escapeCsv(node.data?.name || node.name),
      escapeCsv(node.data?.surname || node.surname),
      escapeCsv(node.data?.maiden_name || node.maiden_name),
      escapeCsv(node.data?.birth_date || node.birth_date),
      escapeCsv(node.data?.death_date || node.death_date),
      escapeCsv(node.data?.street || node.street),
      escapeCsv(node.data?.street_number || node.street_number),
      escapeCsv(node.data?.city || node.city),
      escapeCsv(node.data?.zip || node.zip),
      escapeCsv(node.data?.country || node.country),
      escapeCsv(node.data?.phone || node.phone),
      escapeCsv(node.data?.email || node.email)
    ].join(',');
  });
  
  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n');
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
          // Use s3Url or url, preferring s3Url
          const imageUrl = image.s3Url || image.url;
          
          if (!imageUrl) {
            continue;
          }
          
          // Load image using Image element (works better with CORS)
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
