-- Create profiles table for user preferences and settings
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  theme_preference TEXT DEFAULT 'system' CHECK (theme_preference IN ('system', 'light', 'dark')),
  location TEXT,
  personal_context TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create activity log table
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on activity_log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Activity log policies
CREATE POLICY "Users can view their own activity"
ON public.activity_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
ON public.activity_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity"
ON public.activity_log FOR DELETE
USING (auth.uid() = user_id);

-- Create connected apps table
CREATE TABLE public.connected_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  app_icon TEXT,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected'))
);

-- Enable RLS on connected_apps
ALTER TABLE public.connected_apps ENABLE ROW LEVEL SECURITY;

-- Connected apps policies
CREATE POLICY "Users can view their own connected apps"
ON public.connected_apps FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own connected apps"
ON public.connected_apps FOR ALL
USING (auth.uid() = user_id);

-- Update chats table to properly reference auth.users
ALTER TABLE public.chats 
ADD CONSTRAINT fk_chats_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing permissive policies on chats
DROP POLICY IF EXISTS "Allow all operations on chats" ON public.chats;

-- Create proper RLS policies for chats
CREATE POLICY "Users can view their own chats"
ON public.chats FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chats"
ON public.chats FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chats"
ON public.chats FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chats"
ON public.chats FOR DELETE
USING (auth.uid() = user_id);

-- Drop existing permissive policies on messages
DROP POLICY IF EXISTS "Allow all operations on messages" ON public.messages;

-- Create proper RLS policies for messages (through chat ownership)
CREATE POLICY "Users can view messages from their chats"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = messages.chat_id 
    AND chats.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages to their chats"
ON public.messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = messages.chat_id 
    AND chats.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete messages from their chats"
ON public.messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = messages.chat_id 
    AND chats.user_id = auth.uid()
  )
);

-- Create trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Update profiles timestamp trigger
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_profiles_id ON public.profiles(id);
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX idx_connected_apps_user_id ON public.connected_apps(user_id);