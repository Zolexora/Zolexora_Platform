import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v2 as cloudinary } from 'cloudinary'
import { v4 as uuidv4 } from 'uuid'

export type UploadFolder =
  | 'profiles'
  | 'properties'
  | 'aadhaar'
  | 'receipts'
  | 'agreements'
  | 'maintenance'

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)
  private readonly s3: S3Client

  // Max sizes
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024   // 5 MB
  private readonly MAX_PDF_SIZE   = 10 * 1024 * 1024  // 10 MB
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  private readonly ALLOWED_PDF_TYPES   = ['application/pdf']

  constructor(private config: ConfigService) {
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID')
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY')

    this.s3 = new S3Client({
      region: config.get('AWS_REGION') ?? 'ap-south-1',
      credentials: accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
    })

    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key:    config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    })
  }

  // ─── UPLOAD IMAGE TO CLOUDINARY (room photos, profile pics) ──────────────────

  async uploadImage(
    buffer: Buffer,
    mimeType: string,
    folder: UploadFolder,
    options?: { width?: number; height?: number; quality?: number },
  ): Promise<{ url: string; thumbnailUrl: string; publicId: string }> {
    this.validateFile(buffer, mimeType, this.ALLOWED_IMAGE_TYPES, this.MAX_IMAGE_SIZE)

    const publicId = `${folder}/${uuidv4()}`

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id:    publicId,
          folder:       `rent-stay/${folder}`,
          resource_type: 'image',
          transformation: [
            {
              width:   options?.width   ?? 1200,
              height:  options?.height  ?? 900,
              crop:    'limit',
              quality: options?.quality ?? 'auto:good',
              format:  'webp',
            },
          ],
          eager: [
            // Thumbnail version
            { width: 400, height: 300, crop: 'fill', quality: 'auto:low', format: 'webp' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error)
            return reject(new BadRequestException('Image upload failed. Please try again.'))
          }
          resolve({
            url:          result.secure_url,
            thumbnailUrl: result.eager?.[0]?.secure_url ?? result.secure_url,
            publicId:     result.public_id,
          })
        },
      )
      uploadStream.end(buffer)
    })
  }

  // ─── UPLOAD PDF TO S3 (Aadhaar, agreements, receipts) ────────────────────────
  // Encrypted at rest via S3 SSE-S3. Never served publicly — presigned URLs only.

  async uploadPDF(
    buffer: Buffer,
    mimeType: string,
    folder: UploadFolder,
    filename?: string,
  ): Promise<{ key: string; url: string }> {
    this.validateFile(buffer, mimeType, this.ALLOWED_PDF_TYPES, this.MAX_PDF_SIZE)

    const key    = `${folder}/${uuidv4()}${filename ? `-${filename}` : ''}.pdf`
    const bucket = this.config.get<string>('AWS_S3_BUCKET')!

    await this.s3.send(new PutObjectCommand({
      Bucket:               bucket,
      Key:                  key,
      Body:                 buffer,
      ContentType:          'application/pdf',
      ServerSideEncryption: 'AES256',  // encrypted at rest
      Metadata: { folder, uploadedAt: new Date().toISOString() },
    }))

    // Return presigned URL valid for 7 days
    const url = await this.getPresignedUrl(key)

    this.logger.log(`PDF uploaded to S3: ${key}`)
    return { key, url }
  }

  // ─── GET PRESIGNED URL (temporary access to private S3 file) ─────────────────

  async getPresignedUrl(key: string, expiresInSeconds = 60 * 60 * 24 * 7): Promise<string> {
    const bucket = this.config.get<string>('AWS_S3_BUCKET')!
    return getSignedUrl(this.s3, new GetObjectCommand({
      Bucket:  bucket,
      Key:     key,
    }), { expiresIn: expiresInSeconds })
  }

  // ─── DELETE FROM CLOUDINARY ───────────────────────────────────────────────────

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId)
    } catch (err) {
      this.logger.warn(`Could not delete Cloudinary image ${publicId}: ${err}`)
    }
  }

  // ─── DELETE FROM S3 ───────────────────────────────────────────────────────────

  async deleteFromS3(key: string): Promise<void> {
    const bucket = this.config.get<string>('AWS_S3_BUCKET')!
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    } catch (err) {
      this.logger.warn(`Could not delete S3 object ${key}: ${err}`)
    }
  }

  // ─── VALIDATE FILE ────────────────────────────────────────────────────────────

  private validateFile(
    buffer: Buffer,
    mimeType: string,
    allowedTypes: string[],
    maxSize: number,
  ): void {
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid file type: ${mimeType}. Allowed: ${allowedTypes.join(', ')}`,
      )
    }
    if (buffer.length > maxSize) {
      const maxMB = Math.round(maxSize / 1024 / 1024)
      throw new BadRequestException(`File too large. Maximum size is ${maxMB} MB.`)
    }
  }
}
