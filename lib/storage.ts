import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = 'documents';

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(safeName, buffer, {
      contentType: getContentType(filename),
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(safeName, 60 * 60 * 24 * 365);

  if (urlError || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${urlError?.message}`);
  }

  return data.signedUrl;
}

export async function deleteFile(signedUrl: string): Promise<void> {
  try {
    const match = signedUrl.match(/\/object\/sign\/documents\/([^?]+)/);
    if (!match) return;
    await supabase.storage.from(BUCKET).remove([decodeURIComponent(match[1])]);
  } catch {
    console.warn('[storage] deleteFile failed silently:', signedUrl);
  }
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return types[ext || ''] || 'application/octet-stream';
}