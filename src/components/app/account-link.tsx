import { Link } from "@tanstack/react-router";
import { CircleUserRound } from "lucide-react";

import { barIconClass } from "@/components/app/screen-header";
import { useAuthEmail } from "@/hooks/use-auth-email";

/** Avatar button that opens the Profile screen. */
export function AccountLink() {
  const email = useAuthEmail();
  return (
    <Link to="/me" aria-label="Profile" className={barIconClass} activeProps={{ className: "bg-muted" }}>
      {email ? (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
          {email[0]}
        </span>
      ) : (
        <CircleUserRound className="!h-6 !w-6" />
      )}
    </Link>
  );
}
