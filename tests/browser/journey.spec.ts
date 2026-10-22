import { test, expect } from "@playwright/test";
async function nav(page: import("@playwright/test").Page, name: string) {
  const mobile = page.getByRole("button", { name: "Open navigation" });
  if (await mobile.isVisible()) await mobile.click();
  await page.getByRole("button", { name, exact: true }).click();
}
test("complete isolated planning journey, version decisions, task actuals, exports and reload", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "A little better, every stay." }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/overview-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /Santa Croce Studio.*A calmer stay/ })
    .click();
  await page
    .getByRole("button", { name: "Evidence", exact: false })
    .filter({ hasText: "Evidence" })
    .first()
    .click();
  for (const count of ["8", "5", "3"])
    await expect(
      page
        .locator(".support-count strong")
        .filter({ hasText: new RegExp("^" + count + "$") }),
    ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Import reviews", exact: true })
    .click();
  await page
    .getByLabel(/Or paste reviews/)
    .fill("A clean and comfortable stay.");
  await page.getByRole("button", { name: "Preview pasted reviews" }).click();
  await page
    .getByRole("button", { name: "Confirm import · 1 reviews" })
    .click();
  await expect(page.getByText("41 included reviews")).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze feedback", exact: true })
    .click();
  await expect(
    page.getByText("Analysis current", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".stage-nav")
    .getByRole("button", { name: /Options/ })
    .click();
  await expect(page.getByText("€500.00", { exact: true })).toBeVisible();
  await expect(page.getByText("€200.00", { exact: true })).toBeVisible();
  await page
    .locator(".stage-nav")
    .getByRole("button", { name: /Approval/ })
    .click();
  await page
    .getByRole("button", { name: "Submit for approval", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "Approve revision 1", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Demo persona").selectOption("demo-owner");
  await page
    .getByRole("button", { name: "Approve revision 1", exact: true })
    .click();
  await page
    .getByLabel("Decision note")
    .fill("Accepted with measurement conditions.");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(
    page.getByText("Current revision approved", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Purchases blocked", { exact: true }),
  ).toBeVisible();
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Project JSON" }).click();
  expect((await jsonDownload).suggestedFilename()).toContain(".json");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Budget CSV" }).click();
  expect((await csvDownload).suggestedFilename()).toContain(".csv");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-sheet")).toBeVisible();
  await expect(page.locator(".print-sheet")).toContainText(
    "DEMO — SYNTHETIC DATA",
  );
  await page.emulateMedia({ media: "screen" });
  await page
    .locator(".stage-nav")
    .getByRole("button", { name: /Completion/ })
    .click();
  const verification = page
    .getByRole("row")
    .filter({ hasText: "Verify measurements and delivery: Blackout" });
  await verification.getByRole("button", { name: "Update" }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("done");
  await page.getByLabel("Actual expenditure · EUR").fill("12.50");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(
    page.getByText("€12.50 recorded actual expenditure"),
  ).toBeVisible();
  await page
    .locator(".stage-nav")
    .getByRole("button", { name: /Brief/ })
    .click();
  await page.getByLabel("Project budget · EUR").fill("800");
  await page.getByRole("button", { name: "Save brief" }).click();
  await page
    .locator(".stage-nav")
    .getByRole("button", { name: /Approval/ })
    .click();
  await expect(
    page.getByText("The current draft needs approval", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit for approval", exact: false }),
  ).toBeEnabled();
  await page.getByText("Version & decision history · 1").click();
  await expect(page.getByText("Revision 1", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /Santa Croce Studio.*A calmer stay/ })
    .click();
  await expect(page.getByLabel("Project budget · EUR")).toHaveValue("800");
  await page.screenshot({
    path: `test-results/brief-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("catalog editing and new empty property remain stored; live setup never shows demo data", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "A little better, every stay." }),
  ).toBeVisible();
  await nav(page, "Product catalog");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name").fill("Synthetic reading chair");
  await page.getByLabel("Unit price · EUR").fill("75.50");
  await page.getByRole("button", { name: "Save offer" }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic reading chair" }),
  ).toBeVisible();
  await nav(page, "Add property");
  await page.getByLabel("Property name").fill("Test apartment");
  await page.getByLabel("City", { exact: true }).fill("Florence");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add property" })
    .click();
  await page.reload();
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await expect(
    page.getByRole("button", { name: "Test apartment", exact: true }),
  ).toBeAttached();
  await page.goto("/app");
  await expect(page.getByText("Live workspace · setup required")).toBeVisible();
  await expect(page.getByText("Santa Croce Studio")).toHaveCount(0);
});
