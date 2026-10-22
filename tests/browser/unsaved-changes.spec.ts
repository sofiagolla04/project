import { expect, test, type Page } from "@playwright/test";

async function openBrief(page: Page) {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: /Santa Croce Studio.*A calmer stay/ })
    .click();
}

async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name, exact: true }).click();
}

test("sidebar, back link and persona switching protect unsaved input", async ({
  page,
}) => {
  await openBrief(page);
  const budget = page.getByLabel("Project budget · EUR");
  await budget.fill("825");

  for (const target of ["Overview", "Product catalog", "Workspace settings"]) {
    const dialog = page.waitForEvent("dialog");
    const navigation = navigate(page, target);
    const prompt = await dialog;
    expect(prompt.message()).toContain("unsaved changes");
    await prompt.dismiss();
    await navigation;
    await expect(budget).toHaveValue("825");
    const close = page.getByRole("button", { name: "Close navigation" });
    if (await close.isVisible()) await close.click();
  }

  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "← All projects", exact: true })
    .click();
  await expect(budget).toHaveValue("825");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Demo persona").selectOption("demo-owner");
  await expect(page.getByLabel("Demo persona")).toHaveValue("demo-operator");
  await expect(budget).toHaveValue("825");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Demo persona").selectOption("demo-owner");
  await expect(budget).toHaveValue("700");
});

test("failed saves retain the discard warning and successful saves clear it", async ({
  page,
}) => {
  await openBrief(page);
  const budget = page.getByLabel("Project budget · EUR");
  // The domain limit is EUR 1,000,000; this is a valid HTML number but an
  // invalid plan, exercising dispatch's handled failure rather than HTML validation.
  await budget.fill("1000001");
  await page.getByRole("button", { name: "Save brief", exact: true }).click();
  await expect(page.locator('.notice[role="alert"]')).toBeVisible();
  await expect(budget).toHaveValue("1000001");
  await expect(budget.locator("xpath=ancestor::form")).toHaveAttribute(
    "data-dirty",
    "true",
  );

  const rejectedNavigation = page.waitForEvent("dialog");
  const back = page
    .getByRole("button", { name: "← All projects", exact: true })
    .click();
  await (await rejectedNavigation).dismiss();
  await back;
  await expect(budget).toHaveValue("1000001");

  await budget.fill("825");
  await page.getByRole("button", { name: "Save brief", exact: true }).click();
  await expect(page.locator('form[data-dirty="true"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "← All projects", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little better, every stay." }),
  ).toBeVisible();
});

test("the next-step guide opens a reviewable plan at approval", async ({
  page,
}) => {
  await openBrief(page);
  const guide = page.getByRole("region", { name: "Suggested next step" });
  await expect(guide).toContainText("Your plan can be reviewed.");
  await guide.getByRole("button", { name: "Review & submit the plan" }).click();
  await expect(
    page.getByRole("button", { name: /Submit for approval/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Current revision approved", { exact: true }),
  ).toHaveCount(0);
});
