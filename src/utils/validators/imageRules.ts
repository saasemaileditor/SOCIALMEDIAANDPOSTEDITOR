export const IMAGE_RULES = {
  maxSizeMB: 2,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  acceptString: 'image/jpeg,image/png,image/webp,image/svg+xml'
};

export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!IMAGE_RULES.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid image format. Only JPG, PNG, WebP, and SVG are allowed.' };
  }
  if (file.size > IMAGE_RULES.maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Image must be smaller than ${IMAGE_RULES.maxSizeMB}MB.` };
  }
  return { valid: true };
}
