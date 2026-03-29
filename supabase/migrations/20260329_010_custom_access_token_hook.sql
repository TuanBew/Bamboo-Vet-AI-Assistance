-- Custom Access Token Hook: injects is_admin claim into JWT
-- Must be registered in Supabase Dashboard > Authentication > Hooks > Custom Access Token

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_is_admin boolean;
BEGIN
  -- Extract the user's is_admin status from profiles
  SELECT is_admin INTO user_is_admin
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  -- Default to false if no profile found
  IF user_is_admin IS NULL THEN
    user_is_admin := false;
  END IF;

  -- Get existing claims
  claims := event->'claims';

  -- Set is_admin in app_metadata within claims
  IF claims->'app_metadata' IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  claims := jsonb_set(claims, '{app_metadata, is_admin}', to_jsonb(user_is_admin));

  -- Update the event with modified claims
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin (required for hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated;
