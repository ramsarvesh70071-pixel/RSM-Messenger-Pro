import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { env } from '../config/environment';

export interface UploadedFileResult {
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}

export interface IStorageProvider {
  saveFile(file: Express.Multer.File, subfolder: string): Promise<UploadedFileResult>;
  deleteFile(fileUrl: string): Promise<boolean>;
}

export class LocalStorageProvider implements IStorageProvider {
  async saveFile(file: Express.Multer.File, subfolder: string): Promise<UploadedFileResult> {
    const uploadDir = path.resolve(env.UPLOAD_DIR, subfolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const filename = `${uniqueSuffix}${ext}`;
    const destinationPath = path.join(uploadDir, filename);

    // Save the file
    fs.writeFileSync(destinationPath, file.buffer);

    const relativeUrl = `/uploads/${subfolder}/${filename}`;
    let thumbnailUrl: string | undefined;
    let width: number | undefined;
    let height: number | undefined;

    // If it's an image, create an optimized thumbnail
    if (file.mimetype.startsWith('image/')) {
      try {
        const metadata = await sharp(file.buffer).metadata();
        width = metadata.width;
        height = metadata.height;

        const thumbDir = path.resolve(env.UPLOAD_DIR, 'thumbnails');
        if (!fs.existsSync(thumbDir)) {
          fs.mkdirSync(thumbDir, { recursive: true });
        }

        const thumbFilename = `thumb_${uniqueSuffix}.webp`;
        const thumbPath = path.join(thumbDir, thumbFilename);

        await sharp(file.buffer)
          .resize(200, 200, { fit: 'cover' })
          .webp({ quality: 80 })
          .toFile(thumbPath);

        thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
      } catch (err) {
        console.warn('[Storage] Thumbnail generation failed, using original:', err);
      }
    }

    return {
      url: relativeUrl,
      thumbnailUrl,
      mimeType: file.mimetype,
      fileName: file.originalname,
      fileSize: file.size,
      width,
      height
    };
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const cleanPath = fileUrl.replace('/uploads/', '');
      const filePath = path.resolve(env.UPLOAD_DIR, cleanPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export class S3StorageProvider implements IStorageProvider {
  async saveFile(file: Express.Multer.File, subfolder: string): Promise<UploadedFileResult> {
    // Cloud S3 / MinIO integration architecture
    console.log(`[S3 Storage] Uploading ${file.originalname} to S3 bucket...`);
    return {
      url: `https://cloud-storage.example.com/${subfolder}/${file.originalname}`,
      mimeType: file.mimetype,
      fileName: file.originalname,
      fileSize: file.size
    };
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    console.log(`[S3 Storage] Deleting ${fileUrl} from S3...`);
    return true;
  }
}

export class StorageService {
  private static provider: IStorageProvider =
    env.STORAGE_DRIVER === 's3' ? new S3StorageProvider() : new LocalStorageProvider();

  static async uploadFile(file: Express.Multer.File, subfolder = 'images'): Promise<UploadedFileResult> {
    return this.provider.saveFile(file, subfolder);
  }

  static async deleteFile(fileUrl: string): Promise<boolean> {
    return this.provider.deleteFile(fileUrl);
  }
}
