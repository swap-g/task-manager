import { supabase } from './supabaseClient'

// Builds a backend-agnostic `window.storage` interface backed by the
// Supabase `app_kv` table for a single authenticated user. The TaskManager
// component only ever talks to this interface, so swapping backends later
// means rewriting this file alone.
//
// Table shape (see supabase/schema.sql):
//   app_kv (user_id uuid, key text, value text, updated_at timestamptz,
//           primary key (user_id, key))
// RLS guarantees a user can only read/write rows where auth.uid() = user_id.
export function makeStorage(userId) {
  return {
    // Returns the stored string value for `key`, or null if absent.
    async get(key) {
      const { data, error } = await supabase
        .from('app_kv')
        .select('value')
        .eq('user_id', userId)
        .eq('key', key)
        .maybeSingle()
      if (error) {
        console.error('storage.get error', key, error)
        return null
      }
      return data ? data.value : null
    },

    // Upserts `value` (a string) under `key` for this user.
    async set(key, value) {
      const { error } = await supabase.from('app_kv').upsert(
        {
          user_id: userId,
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' }
      )
      if (error) {
        console.error('storage.set error', key, error)
        throw error
      }
    },

    // Removes a key for this user.
    async delete(key) {
      const { error } = await supabase
        .from('app_kv')
        .delete()
        .eq('user_id', userId)
        .eq('key', key)
      if (error) {
        console.error('storage.delete error', key, error)
        throw error
      }
    },

    // Returns [{ key, value }] for all keys starting with `prefix`.
    async list(prefix = '') {
      let query = supabase
        .from('app_kv')
        .select('key, value')
        .eq('user_id', userId)
      if (prefix) query = query.like('key', `${prefix}%`)
      const { data, error } = await query
      if (error) {
        console.error('storage.list error', prefix, error)
        return []
      }
      return data || []
    },

    // Subscribes to realtime changes for this user's rows. Calls
    // `onChange({ key, value })` for every insert/update/delete (value is
    // null on delete). Returns an unsubscribe function.
    subscribe(onChange) {
      const channel = supabase
        .channel(`app_kv:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_kv',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new && Object.keys(payload.new).length
              ? payload.new
              : payload.old
            if (!row || !row.key) return
            const value =
              payload.eventType === 'DELETE' ? null : row.value ?? null
            onChange({ key: row.key, value, eventType: payload.eventType })
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    },
  }
}
