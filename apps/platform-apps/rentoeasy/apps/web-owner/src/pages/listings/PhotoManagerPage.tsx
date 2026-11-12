// ─── PHOTO MANAGER ────────────────────────────────────────────────────────────
import { useState, useRef }               from 'react'
import { useParams, useNavigate, Link }    from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Trash2, Star, ChevronLeft, Loader2, GripVertical } from 'lucide-react'
import { propertiesAPI } from '@/services/api'

export function PhotoManagerPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data: property } = useQuery({
    queryKey: ['property', id],
    queryFn:  () => propertiesAPI.getOne(id!) as any,
    enabled:  !!id,
  })

  const photos = (property as any)?.photos ?? []

  const addMut = useMutation({
    mutationFn: (file: File) => propertiesAPI.addPhoto(id!, file),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['property', id] }),
  })

  const delMut = useMutation({
    mutationFn: (photoId: string) => propertiesAPI.deletePhoto(id!, photoId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['property', id] }),
  })

  const primaryMut = useMutation({
    mutationFn: (photoId: string) => propertiesAPI.setPrimary(id!, photoId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['property', id] }),
  })

  const handleFiles = async (files: FileList) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      if (photos.length >= 10) break
      await addMut.mutateAsync(file).catch(() => {})
    }
    setUploading(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/listings')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manage Photos</h1>
          <p className="text-sm text-gray-500">{photos.length}/10 photos</p>
        </div>
      </div>

      {/* Upload zone */}
      {photos.length < 10 && (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8
                     flex flex-col items-center gap-2 hover:border-violet-400 hover:bg-violet-50 transition-colors"
        >
          {uploading
            ? <Loader2 size={24} className="animate-spin text-violet-500" />
            : <Upload size={24} className="text-gray-300" />}
          <p className="text-sm font-medium text-gray-700">
            {uploading ? 'Uploading…' : 'Click to upload photos'}
          </p>
          <p className="text-xs text-gray-400">JPG, PNG, WebP · max 5MB each · up to {10 - photos.length} more</p>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)} />

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo: any) => (
          <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100">
            <img src={photo.url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              {!photo.isPrimary && (
                <button onClick={() => primaryMut.mutate(photo.id)}
                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-yellow-50"
                  title="Set as primary">
                  <Star size={14} className="text-amber-500" />
                </button>
              )}
              <button onClick={() => delMut.mutate(photo.id)}
                className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-red-50"
                title="Delete photo">
                <Trash2 size={14} className="text-red-500" />
              </button>
            </div>
            {photo.isPrimary && (
              <div className="absolute top-2 left-2 bg-yellow-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Star size={9} className="fill-white" /> Primary
              </div>
            )}
          </div>
        ))}
      </div>

      {photos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3">
          <Link to="/listings" className="btn-primary w-full block text-center">
            Done — Go to Listings
          </Link>
        </div>
      )}
    </div>
  )
}
