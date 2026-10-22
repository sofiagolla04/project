import Link from "next/link";
import Planner from "@/components/planner";
import { configured } from "@/server/supabase";
export const dynamic = "force-dynamic";
export default function Live() {
  if (!configured())
    return (
      <main className="setup-page">
        <Link href="/" className="eyebrow">
          HOST UPGRADE PLANNER
        </Link>
        <span className="badge amber">Live workspace · setup required</span>
        <h1>
          Your workspace,
          <br />
          ready for its foundations.
        </h1>
        <p>
          Live workspaces need connected authentication, a database and private
          file storage. No sample data will be added to your workspace.
        </p>
        <ol>
          <li>
            Create a Supabase project and apply the supplied database migration.
          </li>
          <li>
            Add the Supabase URL, publishable key, server key and application
            origin in secure environment settings.
          </li>
          <li>
            Configure authentication redirect URLs, then restart the
            application.
          </li>
        </ol>
        <p>AI configuration is optional: you can build plans manually.</p>
        <div className="row">
          <Link className="button primary" href="/demo">
            Try the separate demo
          </Link>
          <Link className="button secondary" href="/">
            Back to home
          </Link>
        </div>
        <small>
          Setup instructions: README.md and .env.example in the project
          repository.
        </small>
      </main>
    );
  return <Planner mode="live" />;
}
