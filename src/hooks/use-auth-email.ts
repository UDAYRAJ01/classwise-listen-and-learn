import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/** Signed-in email: undefined while checking, null when signed out. */
export function useAuthEmail(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return email;
}
