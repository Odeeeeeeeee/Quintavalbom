// Supabase config -- vervang met je eigen project URL en anon key
// De anon key is veilig om in client-side code te gebruiken (RLS beschermt data)
export const SUPABASE_URL = 'https://psqvxtrsgungbsydthua.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzcXZ4dHJzZ3VuZ2JzeWR0aHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTY5NjYsImV4cCI6MjA5MzYzMjk2Nn0.xmU08xjfGSwcCjO4P8N0EmEARwTcSpocELhj2nvrDZ4'

// Alleen deze e-mailadressen mogen inloggen
export const ALLOWED_EMAILS = [
  'ody@dothorizon.nl',
  'motho@quintavalbom.nl',
]
