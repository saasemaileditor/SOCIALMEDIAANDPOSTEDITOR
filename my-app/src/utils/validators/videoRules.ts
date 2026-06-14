export const VIDEO_RULES = {
  maxSizeMB: 10,
  allowedTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  acceptString: 'video/mp4,video/webm,video/ogg,video/quicktime'
};

export function validateVideo(file: File): { valid: boolean; error?: string } {
  if (!VIDEO_RULES.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid video format. Only MP4, WebM, OGG, and MOV are allowed.' };
  }
  if (file.size > VIDEO_RULES.maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Video must be smaller than ${VIDEO_RULES.maxSizeMB}MB.` };
  }
  return { valid: true };
}
