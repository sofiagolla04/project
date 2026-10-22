import { expect, test } from "@playwright/test";

const invitation =
  "11111111-1111-4111-8111-11111111111122222222-2222-4222-8222-222222222222";

test("recovery query opens the correct form without hydration errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/auth?recovery=1&invitation=${invitation}`);
  await expect(
    page.getByRole("heading", { name: "Choose a new password." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a missing confirmation code preserves the invitation and explains the failure", async ({
  page,
}) => {
  await page.goto(`/auth/callback?invitation=${invitation}`);
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/auth" &&
      url.searchParams.get("invitation") === invitation &&
      url.searchParams.has("error"),
  );
  await expect(page.getByRole("status")).toContainText(
    "Unable to complete authentication.",
  );
});
