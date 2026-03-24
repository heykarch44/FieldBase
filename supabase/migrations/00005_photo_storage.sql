-- ============================================================
-- 00005: Photo Storage Bucket + Policies
-- ============================================================
-- Sets up Supabase Storage for field photos.
-- Photos upload to cloud immediately — the phone is just the camera.
-- Organized by org_id/entity_type/entity_id/ for clean retrieval.
-- ============================================================

-- 1. Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  false,                           -- private: accessed via signed URLs or RLS
  10485760,                        -- 10 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Upload policy: authenticated users can upload to their org's folder
--    Path pattern: photos/{org_id}/{entity_type}/{entity_id}/{filename}
CREATE POLICY "org_members_upload_photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.active_org_id()::text
);

-- 3. Read policy: authenticated users can read photos from their org
CREATE POLICY "org_members_read_photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.active_org_id()::text
);

-- 4. Delete policy: admins can delete photos from their org
CREATE POLICY "org_admins_delete_photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.active_org_id()::text
  AND public.has_org_role(public.active_org_id(), 'admin')
);

-- 5. Super-admins can read all photos (for admin panel)
CREATE POLICY "super_admins_read_all_photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos'
  AND public.is_super_admin()
);
