// Keeps the per-device notebook in step with the signed-in student's account,
// so saved chapters, done marks and streak follow them to every device.

import { supabase } from "@/integrations/supabase/client";

import {
  getNotebookState,
  mergeNotebooks,
  onNotebookCommit,
  replaceNotebook,
  sanitize,
  type NotebookState,
} from "./notebook-store";

const SYNC_USER_KEY = "padhosuno:sync-user";

let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function push(uid: string, data: NotebookState) {
  await supabase
    .from("user_notebooks")
    .upsert({ user_id: uid, data: data as never, updated_at: new Date().toISOString() });
}

async function pull(uid: string) {
  const { data, error } = await supabase
    .from("user_notebooks")
    .select("data")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) return;
  const remote = data ? sanitize(data.data as Partial<NotebookState>) : null;
  const lastUser = localStorage.getItem(SYNC_USER_KEY);
  if (lastUser === uid && remote) {
    // This device already belongs to the account: account copy is the truth.
    replaceNotebook(remote);
    return;
  }
  // First sign-in on this device: keep everything from both sides.
  const merged = remote ? mergeNotebooks(getNotebookState(), remote) : getNotebookState();
  replaceNotebook(merged);
  localStorage.setItem(SYNC_USER_KEY, uid);
  await push(uid, merged);
}

/** Start once from the root layout. Returns a cleanup. */
export function startNotebookSync() {
  const offCommit = onNotebookCommit((s) => {
    const uid = userId;
    if (!uid) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void push(uid, s);
    }, 800);
  });

  const apply = (uid: string | null, event?: string) => {
    if (uid && uid !== userId) {
      userId = uid;
      void pull(uid);
    } else if (!uid && userId) {
      userId = null;
      if (event === "SIGNED_OUT") {
        // Shared device: don't leave the student's notebook behind.
        localStorage.removeItem(SYNC_USER_KEY);
        replaceNotebook({ prefs: getNotebookState().prefs });
      }
    }
  };

  void supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id ?? null));
  const { data } = supabase.auth.onAuthStateChange((event, session) =>
    apply(session?.user.id ?? null, event),
  );
  const onFocus = () => {
    if (userId && !timer) void pull(userId);
  };
  window.addEventListener("focus", onFocus);

  return () => {
    offCommit();
    data.subscription.unsubscribe();
    window.removeEventListener("focus", onFocus);
  };
}
