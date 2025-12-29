import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ctbwyxpiqrdmnprwvzlj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0Ynd5eHBpcXJkbW5wcnd2emxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NTc5NTIsImV4cCI6MjA4MjMzMzk1Mn0.QepvgCbQKUi5tBfpcHoPgTTT_0bA6Q5FCM_eE-ID0i0'

export const supabase = createClient(supabaseUrl, supabaseKey)