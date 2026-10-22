import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { emptyProject } from "../lib/domain";
const enabled = !!(
  process.env.TEST_SUPABASE_URL &&
  process.env.TEST_SUPABASE_PUBLISHABLE_KEY &&
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
);
describe.skipIf(!enabled)(
  "real Supabase Auth / PostgREST / RLS / Storage (disposable local instance)",
  () => {
    let admin: SupabaseClient, a: SupabaseClient, b: SupabaseClient;
    const users: string[] = [],
      wid = randomUUID(),
      pid = randomUUID();
    const p = emptyProject(pid);
    beforeAll(async () => {
      const url = process.env.TEST_SUPABASE_URL!;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
        throw Error(
          "Integration fixtures require a disposable local Supabase instance.",
        );
      admin = createClient(url, process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });
      for (let i = 0; i < 2; i++) {
        const email = `host-test-${randomUUID()}@example.test`,
          password = randomUUID() + "Aa1!";
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) throw error;
        users.push(data.user.id);
        const client = createClient(
          url,
          process.env.TEST_SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false } },
        );
        const { error: e } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (e) throw e;
        if (i === 0) a = client;
        else b = client;
      }
      for (const result of [
        await admin
          .from("workspaces")
          .insert({ id: wid, name: "Integration workspace" }),
        await admin
          .from("memberships")
          .insert({
            workspace_id: wid,
            user_id: users[0],
            role: "operator",
            display_name: "Test operator",
          }),
        await admin
          .from("properties")
          .insert({ id: pid, workspace_id: wid, name: "Integration property" }),
        await admin
          .from("projects")
          .insert({
            id: p.id,
            workspace_id: wid,
            property_id: pid,
            data: p,
            revision: 0,
          }),
      ])
        if (result.error) throw result.error;
    }, 30000);
    afterAll(async () => {
      if (admin) {
        await admin.from("workspaces").delete().eq("id", wid);
        for (const user of users) await admin.auth.admin.deleteUser(user);
      }
    });
    it("saved live project is returned through an authenticated new query", async () => {
      const { data, error } = await a
        .from("projects")
        .select("data")
        .eq("id", p.id)
        .single();
      expect(error).toBeNull();
      expect(data?.data.name).toBe(p.name);
    });
    it("another account cannot read or modify the project", async () => {
      expect(
        (await b.from("projects").select("*").eq("id", p.id)).data,
      ).toEqual([]);
      expect(
        (await b.from("projects").update({ revision: 9 }).eq("id", p.id)).error,
      ).not.toBeNull();
    });
    it("unauthorized accounts cannot call the privileged write transaction", async () => {
      const { error } = await b.rpc("commit_project", {
        actor: users[0],
        project: p.id,
        expected: 0,
        payload: { ...p, revision: 1 },
        operation: "decide",
      });
      expect(error).not.toBeNull();
    });
    it("private bucket files cannot be uploaded directly by a browser client", async () => {
      const { error } = await b.storage
        .from("property-private")
        .upload(`${wid}/${pid}/unauthorized`, new Uint8Array([1, 2, 3]), {
          contentType: "image/png",
        });
      expect(error).not.toBeNull();
    });
  },
);
