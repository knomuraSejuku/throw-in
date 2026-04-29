-- =====================================================================================
-- Storage Bucket & Policies for Throw In (Clip Attachments)
-- =====================================================================================

-- 1. Create a public bucket for clip attachments
insert into storage.buckets (id, name, public)
values ('clip-attachments', 'clip-attachments', true)
on conflict (id) do nothing;

-- 2. Allow logged in users to upload files
create policy "Authenticated users can upload objects"
on storage.objects for insert
with check (
  bucket_id = 'clip-attachments' and auth.role() = 'authenticated'
);

-- 3. Allow public access to read files 
create policy "Public Access to view objects"
on storage.objects for select
using (
  bucket_id = 'clip-attachments'
);

-- 4. Allow users to update/delete their own objects
create policy "Users can update own objects"
on storage.objects for update
using (
  bucket_id = 'clip-attachments' and auth.uid() = owner
);

create policy "Users can delete own objects"
on storage.objects for delete
using (
  bucket_id = 'clip-attachments' and auth.uid() = owner
);
