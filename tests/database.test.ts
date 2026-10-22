import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { emptyProject } from "../lib/domain";
let db: PGlite;
const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const workspaces = [randomUUID(), randomUUID()],
  properties = [randomUUID(), randomUUID()];
const project = emptyProject(properties[0]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);grant usage on schema public,auth,storage to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`,
  );
  // gen_random_uuid is in core PostgreSQL. PGlite does not ship the optional pgcrypto extension.
  const migration = readFileSync(
    "supabase/migrations/202610210001_initial.sql",
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(migration);
  for (let i = 0; i < users.length; i++)
    await db.query("insert into auth.users values($1,$2,now())", [
      users[i],
      `user${i}@example.test`,
    ]);
  for (let i = 0; i < 2; i++) {
    await db.query("insert into workspaces(id,name) values($1,$2)", [
      workspaces[i],
      `Workspace ${i}`,
    ]);
    await db.query(
      "insert into properties(id,workspace_id,name) values($1,$2,$3)",
      [properties[i], workspaces[i], `Property ${i}`],
    );
  }
  await db.query(
    `insert into memberships values($1,$2,'administrator','Admin'),($1,$3,'operator','Operator'),($1,$4,'approver','Approver'),($5,$6,'administrator','Other admin')`,
    [workspaces[0], users[0], users[1], users[2], workspaces[1], users[3]],
  );
  await db.query("insert into property_access values($1,$2,$3,true)", [
    workspaces[0],
    properties[0],
    users[2],
  ]);
  await db.query("insert into projects values($1,$2,$3,0,$4::jsonb)", [
    project.id,
    workspaces[0],
    properties[0],
    JSON.stringify(project),
  ]);
  await db.query(
    "insert into assets(id,workspace_id,property_id,project_id,path,kind,name) values($1,$2,$3,$4,$5,$6,$7)",
    [
      randomUUID(),
      workspaces[1],
      properties[1],
      null,
      `${workspaces[1]}/${properties[1]}/private`,
      "room",
      "Other private photo",
    ],
  );
  await db.exec(
    "grant select on storage.objects to authenticated;alter table storage.objects enable row level security;",
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function asUser(user: string, sql: string, args: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
it("applies the actual migration and reads saved project after a new query", async () => {
  const r = await asUser(users[1], "select data from projects where id=$1", [
    project.id,
  ]);
  expect(r.rows).toHaveLength(1);
  expect((r.rows[0] as { data: { name: string } }).data.name).toBe(
    project.name,
  );
});
it("RLS hides another workspace, properties, projects and private asset metadata", async () => {
  expect((await asUser(users[3], "select * from projects")).rows).toHaveLength(
    0,
  );
  expect(
    (await asUser(users[0], "select * from properties")).rows,
  ).toHaveLength(1);
  expect((await asUser(users[0], "select * from assets")).rows).toHaveLength(0);
});
it("approver sees only assigned property", async () => {
  const result = await asUser(users[2], "select id from properties");
  expect(result.rows).toEqual([{ id: properties[0] }]);
});
it("direct authenticated writes and privileged RPC are denied", async () => {
  await expect(
    asUser(users[1], "update projects set data='{}'"),
  ).rejects.toThrow("permission denied");
  await expect(
    asUser(users[1], "select commit_project($1,$2,0,'{}','decide')", [
      users[1],
      project.id,
    ]),
  ).rejects.toThrow("permission denied");
});
it("composite foreign key rejects cross-workspace parent/child links", async () => {
  const p = emptyProject(properties[0]);
  await expect(
    db.query("insert into projects values($1,$2,$3,0,$4::jsonb)", [
      p.id,
      workspaces[1],
      properties[0],
      JSON.stringify(p),
    ]),
  ).rejects.toThrow("foreign key");
});
it("transaction rejects an unauthorized operator approval", async () => {
  await expect(
    db.query("select commit_project($1,$2,0,$3::jsonb,'decide')", [
      users[1],
      project.id,
      JSON.stringify({ ...project, revision: 1 }),
    ]),
  ).rejects.toThrow("Approval rights");
});
it("transaction rejects outsider edits despite a valid project identifier", async () => {
  await expect(
    db.query("select commit_project($1,$2,0,$3::jsonb,'saveDraft')", [
      users[3],
      project.id,
      JSON.stringify({ ...project, revision: 1 }),
    ]),
  ).rejects.toThrow("Editing access");
});
it("optimistic concurrency prevents an approval from racing a material edit", async () => {
  const p = { ...project, revision: 1 };
  await db.query("select commit_project($1,$2,0,$3::jsonb,'saveDraft')", [
    users[1],
    project.id,
    JSON.stringify(p),
  ]);
  await expect(
    db.query("select commit_project($1,$2,0,$3::jsonb,'decide')", [
      users[2],
      project.id,
      JSON.stringify(p),
    ]),
  ).rejects.toThrow("Concurrent");
});
it("recipient-bound invitation is single-use and never grants another property", async () => {
  const token = randomUUID();
  await db.query(
    "insert into invitations(workspace_id,email,role,property_ids,token_hash,expires_at,created_by) values($1,$2,'approver',$3,$4,now()+interval '1 hour',$5)",
    [workspaces[0], "user3@example.test", [properties[0]], token, users[0]],
  );
  await expect(
    db.query("select accept_invitation($1,$2)", [users[1], token]),
  ).rejects.toThrow("invited email");
  await db.query("select accept_invitation($1,$2)", [users[3], token]);
  await expect(
    db.query("select accept_invitation($1,$2)", [users[3], token]),
  ).rejects.toThrow("already used");
  const result = await asUser(
    users[3],
    "select property_id from property_access where workspace_id=$1",
    [workspaces[0]],
  );
  expect(result.rows).toEqual([{ property_id: properties[0] }]);
});
it("cannot grant rights to a property in a different workspace", async () => {
  await expect(
    db.query("select set_member_permissions($1,$2,$3,'approver',$4)", [
      users[0],
      workspaces[0],
      users[2],
      [properties[1]],
    ]),
  ).rejects.toThrow("Invalid property");
});
it("cannot remove the final administrator", async () => {
  await expect(
    db.query("select set_member_permissions($1,$2,$1,'operator','{}')", [
      users[0],
      workspaces[0],
    ]),
  ).rejects.toThrow("at least one");
});
it("database uniqueness prevents duplicate property review fingerprints", async () => {
  const rv = {
    id: "canonical-source",
    fingerprint: "same-property-source",
    text: "A source review",
  };
  await db.query("insert into reviews values($1,$2,$3,$4,$5)", [
    rv.id,
    workspaces[0],
    properties[0],
    rv.fingerprint,
    rv,
  ]);
  await expect(
    db.query("insert into reviews values($1,$2,$3,$4,$5)", [
      "different-id",
      workspaces[0],
      properties[0],
      rv.fingerprint,
      { ...rv, id: "different-id" },
    ]),
  ).rejects.toThrow("unique constraint");
});
it("RLS denies cross-property canonical review reads", async () => {
  const other = randomUUID();
  await db.query("insert into properties values($1,$2,$3,$4,$5)", [
    other,
    workspaces[1],
    "Private",
    "Rome",
    "Italy",
  ]);
  await db.query("insert into reviews values($1,$2,$3,$4,$5)", [
    "private-source",
    workspaces[1],
    other,
    "private-fingerprint",
    { id: "private-source" },
  ]);
  expect(
    (await asUser(users[2], "select id from reviews where id='private-source'"))
      .rows,
  ).toHaveLength(0);
});
