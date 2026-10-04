import { Response } from 'express';
import { StorageService } from '../services/storage.service';
import { Upload } from '../models/Upload.model';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class MediaController {
  static async uploadMedia(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'No media file provided', 400);
        return;
      }

      let subfolder = 'documents';
      if (req.file.mimetype.startsWith('image/')) subfolder = 'images';
      else if (req.file.mimetype.startsWith('video/')) subfolder = 'videos';
      else if (req.file.mimetype.startsWith('audio/')) subfolder = 'audio';

      const result = await StorageService.uploadFile(req.file, subfolder);

      await Upload.create({
        userId: req.user._id,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl || '',
        fileName: result.fileName,
        mimeType: result.mimeType,
        fileSize: result.fileSize,
        isAttached: false
      });

      sendSuccess(res, result, 'Media uploaded successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to upload media', 500, error instanceof Error ? error.message : 'Unknown');
    }
  }
}
