// src/api/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your Supabase project URL and anon key
const supabaseUrl = 'https://bkyvzjaaioabifyyorip.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreXZ6amFhaW9hYmlmeXlvcmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MDg0MzksImV4cCI6MjA4MTI4NDQzOX0.TUjyNZ55Q1rkTRqbXPA08yp-Y598u7iertRoNcWQ3EM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
