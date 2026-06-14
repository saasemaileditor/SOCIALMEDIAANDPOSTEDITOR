import { supabase } from '../lib/supabase';

// ── Metadata Extractors ───────────────────────────────────────────────────────

/** Extracts duration from a video file using the browser's video element */
function extractVideoMetadata(file: File): Promise<{ duration_seconds: number }> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = url;
        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve({ duration_seconds: Math.round(video.duration) });
        };
        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ duration_seconds: 0 });
        };
    });
}

/** Extracts width and height from an image file */
function extractImageMetadata(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ width: 0, height: 0 });
        };
    });
}

// ── Main Upload Function ──────────────────────────────────────────────────────

export interface UploadResult {
    success: boolean;
    error?: string;
}

export async function uploadAssetToSupabase(
    file: File,
    assetType: 'video' | 'image'
): Promise<UploadResult> {
    try {
        // Step 1: Get the logged-in user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'You must be logged in to upload files.' };
        }

        // Step 2: Extract metadata from the file before uploading
        let metadata: Record<string, unknown> = {};
        if (assetType === 'video') {
            metadata = await extractVideoMetadata(file);
        } else if (assetType === 'image') {
            metadata = await extractImageMetadata(file);
        }

        // Step 3: Upload the actual file to Supabase Storage Bucket
        // Path: assets/<user_id>/<timestamp>_<filename>  (ensures no name clashes)
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: storageError } = await supabase.storage
            .from('assets')
            .upload(filePath, file, { upsert: false });

        if (storageError) {
            return { success: false, error: `Storage upload failed: ${storageError.message}` };
        }

        // Step 4: Get the public URL of the uploaded file
        const { data: urlData } = supabase.storage
            .from('assets')
            .getPublicUrl(filePath);

        const fileUrl = urlData?.publicUrl;
        if (!fileUrl) {
            return { success: false, error: 'Could not get file URL after upload.' };
        }

        // Step 5: Save a clean record in the user_assets table
        const { error: dbError } = await supabase
            .from('user_assets')
            .insert({
                user_id: user.id,
                asset_type: assetType,
                file_name: file.name,
                file_url: fileUrl,
                size_bytes: file.size,
                metadata,
            });

        if (dbError) {
            return { success: false, error: `Database save failed: ${dbError.message}` };
        }

        return { success: true };

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        return { success: false, error: message };
    }
}

// ── Main Delete Function ──────────────────────────────────────────────────────

export async function deleteAssetFromSupabase(assetId: string, fileUrl: string): Promise<UploadResult> {
    try {
        // Step 1: Extract the file path from the public URL. 
        // Example URL: https://[project].supabase.co/storage/v1/object/public/assets/user_id/12345_file.png
        const urlParts = fileUrl.split('/public/assets/');
        if (urlParts.length === 2) {
            // Fix: We must decode the URL because browser converts spaces to %20 in the public URL.
            // If we don't decode it, the bucket looks for a file with literal %20 in the name and fails.
            const filePath = decodeURIComponent(urlParts[1]);
            // Delete the physical file from the Storage Bucket
            const { error: storageError } = await supabase.storage.from('assets').remove([filePath]);
            if (storageError) console.error("Storage delete error:", storageError);
        }

        // Step 2: Delete the row from the database table
        const { error: dbError } = await supabase
            .from('user_assets')
            .delete()
            .eq('id', assetId);

        if (dbError) {
            return { success: false, error: `Database delete failed: ${dbError.message}` };
        }

        return { success: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred while deleting.';
        return { success: false, error: message };
    }
}
