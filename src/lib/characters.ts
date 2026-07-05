import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Character = Tables<'characters'>

export async function listCharacters(userId: string): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCharacter(
  userId: string,
  input: { name: string; description: string; photo?: File | Blob | null }
): Promise<Character> {
  const { data, error } = await supabase
    .from('characters')
    .insert({ user_id: userId, name: input.name.trim(), description: input.description.trim() })
    .select()
    .single()
  if (error) throw error

  if (!input.photo) return data

  const photoUrl = await uploadCharacterPhoto(userId, data.id, input.photo)
  const { data: updated, error: updateError } = await supabase
    .from('characters')
    .update({ photo_url: photoUrl })
    .eq('id', data.id)
    .select()
    .single()
  if (updateError) throw updateError
  return updated
}

export async function updateCharacter(
  character: Character,
  input: { name: string; description: string; photo?: File | Blob | null }
): Promise<Character> {
  const photoUrl = input.photo
    ? await uploadCharacterPhoto(character.user_id, character.id, input.photo)
    : character.photo_url

  const { data, error } = await supabase
    .from('characters')
    .update({ name: input.name.trim(), description: input.description.trim(), photo_url: photoUrl })
    .eq('id', character.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCharacter(character: Character): Promise<void> {
  if (character.photo_url) {
    await supabase.storage.from('characters').remove([character.photo_url])
  }
  const { error } = await supabase.from('characters').delete().eq('id', character.id)
  if (error) throw error
}

async function uploadCharacterPhoto(
  userId: string,
  characterId: string,
  file: File | Blob
): Promise<string> {
  const path = `${userId}/characters/${characterId}/photo.jpg`
  const { error } = await supabase.storage
    .from('characters')
    .upload(path, file, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  return path
}
