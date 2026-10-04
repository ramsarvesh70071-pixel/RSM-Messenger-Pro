export const APP_CONFIG = {
  APP_NAME: 'RSM Messenger',
  DEFAULT_COUNTRY_CODE: '+91',
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  DEFAULT_STATUS_EXPIRATION_HOURS: 24,
  MAX_GROUP_MEMBERS: 1024,
  MAX_COMMUNITY_GROUPS: 100,
  PAGINATION_LIMIT: 30,
  ALLOWED_REACTIONS: ['👍', '❤️', '😂', '😮', '😢', '🙏'],
  MEDIA: {
    MAX_IMAGE_SIZE_MB: 20,
    MAX_VIDEO_SIZE_MB: 100,
    MAX_AUDIO_SIZE_MB: 30,
    MAX_DOCUMENT_SIZE_MB: 100,
    IMAGE_MIMES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    VIDEO_MIMES: ['video/mp4', 'video/quicktime', 'video/webm'],
    AUDIO_MIMES: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/m4a', 'audio/webm'],
    DOCUMENT_MIMES: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'text/plain'
    ]
  }
};
