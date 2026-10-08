CREATE TABLE public.tier_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tier TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, tier, usage_date)
);

GRANT SELECT ON public.tier_usage TO authenticated;
GRANT ALL ON public.tier_usage TO service_role;

ALTER TABLE public.tier_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
ON public.tier_usage FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_tier_usage_updated_at
BEFORE UPDATE ON public.tier_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();