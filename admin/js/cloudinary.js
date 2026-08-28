/**
 * Cloudinary Upload Service
 * admin/js/cloudinary.js
 * 
 * Handles unsigned image uploads to Cloudinary with progress tracking,
 * file validation, and client-side compression.
 * 
 * Only uses client-safe credentials (cloud name + unsigned preset).
 * Never exposes the Cloudinary API Secret.
 */

// ── Configuration ──────────────────────────────────────────────
export const CLOUDINARY_CONFIG = {
  cloudName: 'dbtjm4x6y',
  uploadPreset: 'fd_unsigned', // Create this in Cloudinary Dashboard → Settings → Upload → Add Unsigned Preset
  uploadUrl: 'https://api.cloudinary.com/v1_1/dbtjm4x6y/image/upload',
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  compressThreshold: 2 * 1024 * 1024, // Compress images above 2 MB
  maxDimension: 2048, // Max width/height after compression
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'],
  acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'],
};

// ── Validation ─────────────────────────────────────────────────

/**
 * Validates an image file before upload.
 * @param {File} file 
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateImageFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Check if file is empty / corrupted
  if (file.size === 0) {
    return { valid: false, error: 'The selected file appears to be empty or corrupted.' };
  }

  // Check file type
  const isValidType = CLOUDINARY_CONFIG.acceptedTypes.includes(file.type);
  const extension = '.' + file.name.split('.').pop().toLowerCase();
  const isValidExt = CLOUDINARY_CONFIG.acceptedExtensions.includes(extension);

  if (!isValidType && !isValidExt) {
    return {
      valid: false,
      error: `Unsupported file format. Accepted formats: ${CLOUDINARY_CONFIG.acceptedExtensions.join(', ')}`
    };
  }

  // Check file size
  if (file.size > CLOUDINARY_CONFIG.maxFileSize) {
    const maxMB = (CLOUDINARY_CONFIG.maxFileSize / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${fileMB} MB). Maximum allowed size is ${maxMB} MB.`
    };
  }

  return { valid: true };
};

// ── Client-Side Compression ────────────────────────────────────

/**
 * Compresses an image file using Canvas if it exceeds the threshold.
 * Skips SVG and GIF files (compression would break them).
 * @param {File} file 
 * @returns {Promise<File|Blob>} — compressed blob or original file
 */
export const compressImage = (file) => {
  return new Promise((resolve) => {
    // Don't compress SVGs, GIFs, or small files
    const skipTypes = ['image/svg+xml', 'image/gif'];
    if (skipTypes.includes(file.type) || file.size <= CLOUDINARY_CONFIG.compressThreshold) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      const maxDim = CLOUDINARY_CONFIG.maxDimension;

      // Only resize if larger than max dimension
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output type and quality
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = file.type === 'image/png' ? undefined : 0.85;

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            // Use compressed version (preserving original filename)
            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            // Compressed is larger somehow — use original
            resolve(file);
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // If image can't be loaded for compression, use original
      resolve(file);
    };

    img.src = objectUrl;
  });
};

// ── Upload ─────────────────────────────────────────────────────

/**
 * Uploads a file to Cloudinary using an unsigned upload preset.
 * @param {File|Blob} file — the image file to upload
 * @param {function(number):void} onProgress — progress callback (0–100)
 * @returns {Promise<{ secure_url: string, public_id: string, format: string, width: number, height: number, bytes: number }>}
 */
export const uploadToCloudinary = (file, onProgress = () => {}) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            secure_url: response.secure_url,
            public_id: response.public_id,
            format: response.format,
            width: response.width,
            height: response.height,
            bytes: response.bytes,
          });
        } catch (parseErr) {
          reject(new Error('Failed to parse Cloudinary response.'));
        }
      } else {
        // Try to extract error message from Cloudinary
        let errorMsg = 'Upload failed.';
        try {
          const errResponse = JSON.parse(xhr.responseText);
          errorMsg = errResponse?.error?.message || `Upload failed (HTTP ${xhr.status}).`;
        } catch (_) {
          errorMsg = `Upload failed with status ${xhr.status}.`;
        }
        reject(new Error(errorMsg));
      }
    });

    // Handle network errors
    xhr.addEventListener('error', () => {
      reject(new Error('Network error. Please check your connection and try again.'));
    });

    // Handle abort
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was cancelled.'));
    });

    // Handle timeout
    xhr.timeout = 120000; // 2 minutes
    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out. Please try again with a smaller file or better connection.'));
    });

    xhr.open('POST', CLOUDINARY_CONFIG.uploadUrl);
    xhr.send(formData);
  });
};
