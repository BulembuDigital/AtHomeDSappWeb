// sdk/supabaseClient.js

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Prevent multiple instances (helpful for hot reload)
if (!window.supabase) {
    window.supabase = createClient(
        "https://ocumymkpotzyyelbctls.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdW15bWtwb3R6eXllbGJjdGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDk5NDEsImV4cCI6MjA2NzQ4NTk0MX0.BeAafZi4o3lPlJDQ6zdBvzxcxz9jFkXV8cBZJH92Unk"
    );
}

export const supabase = window.supabase;
