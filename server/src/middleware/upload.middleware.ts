import multer from 'multer';
import FileType from 'file-type';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

const storage = multer.memoryStorage();

// Per-type max sizes
export const TYPE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,   // 10 MB
  audio: 25 * 1024 * 1024,   // 25 MB
  video: 64 * 1024 * 1024,   // 64 MB
  document: 50 * 1024 * 1024 // 50 MB
};

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/m4a',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain'
];

export const upload = multer({
  storage,
  limits: {
    fileSize: 64 * 1024 * 1024 // 64 MB max ceiling
  },
  fileFilter: (_req, file, cb) => {
    // Browsers append parameters (e.g. "audio/webm;codecs=opus"); compare the base type only
    const baseMime = file.mimetype.split(';')[0].trim().toLowerCase();
    file.mimetype = baseMime;
    if (allowedMimeTypes.includes(baseMime)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

/**
 * Middleware to strictly validate magic bytes and per-type size limits.
 */
export async function validateUploadedFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.file) {
    next();
    return;
  }

  const file = req.file;

  // Sanitize filename: remove directory traversal, null bytes, special characters
  file.originalname = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.');

  // Determine category
  let category = 'document';
  if (file.mimetype.startsWith('image/')) category = 'image';
  else if (file.mimetype.startsWith('video/')) category = 'video';
  else if (file.mimetype.startsWith('audio/')) category = 'audio';

  // Check per-type size limit
  const maxAllowedSize = TYPE_LIMITS[category] || TYPE_LIMITS.document;
  if (file.size > maxAllowedSize) {
    sendError(res, `File size exceeds the limit for ${category} (${maxAllowedSize / (1024 * 1024)}MB)`, 400);
    return;
  }

  // Magic-byte check using file-type
  if (file.buffer && file.buffer.length > 0) {
    // If text/plain, verify it is valid UTF-8
    if (file.mimetype === 'text/plain') {
      const isBinary = file.buffer.slice(0, 512).includes(0);
      if (isBinary) {
        sendError(res, 'File content does not match text/plain format (contains binary data)', 400);
        return;
      }
      next();
      return;
    }

    const detected = await FileType.fromBuffer(file.buffer);

    // If no binary magic bytes detected and not plain text, reject
    if (!detected) {
      // Some simple legacy docs might lack magic bytes, but for images/videos/audio magic bytes MUST be present
      if (category === 'image' || category === 'video' || category === 'audio') {
        sendError(res, 'Spoofed file detected: File content does not match declared media type', 400);
        return;
      }
    } else {
      // Verify detected MIME matches claimed category
      if (category === 'image' && !detected.mime.startsWith('image/')) {
        sendError(res, `Spoofed image detected: content is actually ${detected.mime}`, 400);
        return;
      }
      if (category === 'video' && !detected.mime.startsWith('video/')) {
        sendError(res, `Spoofed video detected: content is actually ${detected.mime}`, 400);
        return;
      }
      if (category === 'audio' && !detected.mime.startsWith('audio/') && !detected.mime.startsWith('video/')) {
        sendError(res, `Spoofed audio detected: content is actually ${detected.mime}`, 400);
        return;
      }

      // Update mimetype with authentic detected type
      file.mimetype = detected.mime;
    }
  }

  next();
}

