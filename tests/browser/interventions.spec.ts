import { test, expect, type Page } from "@playwright/test";

async function openOptions(page: Page) {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "A little better, every stay." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Santa Croce Studio.*A calmer stay/ })
    .click();
  await page
    .locator(".stage-nav")
    .getByRole("button", { name: /Options/ })
    .click();
}

test("manual non-purchase interventions save and persist without a quantity field", async ({
  page,
}) => {
  await openOptions(page);
  const actions = [
    "rearrange",
    "keep",
    "operational_change",
    "inspect",
    "defer",
  ];

  for (const action of actions) {
    const title = `Manual ${action} intervention`;
    await page.getByRole("button", { name: "Add intervention" }).click();
    const dialog = page.getByRole("dialog", { name: "Add intervention" });
    await dialog.getByLabel("Intervention", { exact: true }).fill(title);
    await dialog
      .getByRole("combobox", { name: "Action", exact: true })
      .selectOption(action);
    await expect(dialog.getByLabel("Quantity", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Save intervention" }).click();
    await expect(dialog).toBeHidden();
    const card = page.locator(".option-card").filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });
    await expect(card).toContainText("verified · Qty 1");
    await expect(card.getByText("€0.00", { exact: true })).toBeVisible();
  }

  await openOptions(page);
  for (const action of actions) {
    await expect(
      page.getByRole("heading", {
        name: `Manual ${action} intervention`,
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("purchase quantity remains editable and survives conversion to a non-purchase intervention", async ({
  page,
}) => {
  await openOptions(page);
  await page.getByRole("button", { name: "Add intervention" }).click();
  const create = page.getByRole("dialog", { name: "Add intervention" });
  await create
    .getByLabel("Intervention", { exact: true })
    .fill("Three reading lights");
  await create.getByLabel("Quantity", { exact: true }).fill("3");
  await create.getByLabel("Unit cost including known VAT · EUR").fill("25");
  await create.getByLabel("Cost basis").selectOption("allowance");
  await create.getByRole("button", { name: "Save intervention" }).click();
  await expect(create).toBeHidden();

  const card = page.locator(".option-card").filter({
    has: page.getByRole("heading", {
      name: "Three reading lights",
      exact: true,
    }),
  });
  await expect(card).toContainText("allowance · Qty 3");
  await expect(card.getByText("€75.00", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Compare / edit option" }).click();
  const edit = page.getByRole("dialog", { name: "Edit intervention" });
  await edit
    .getByRole("combobox", { name: "Action", exact: true })
    .selectOption("rearrange");
  await edit.getByLabel("Why this helps").fill("Reuse the existing lights.");
  await expect(edit.getByLabel("Quantity", { exact: true })).toHaveCount(0);
  await edit.getByRole("button", { name: "Save intervention" }).click();
  await expect(edit).toBeHidden();
  await expect(card).toContainText("verified · Qty 3");
  await expect(card.getByText("€0.00", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Compare / edit option" }).click();
  await edit
    .getByLabel("Why this helps")
    .fill("Move the existing lights beside each reading chair.");
  await edit.getByRole("button", { name: "Save intervention" }).click();
  await expect(edit).toBeHidden();
  await expect(card).toContainText("verified · Qty 3");
  await expect(card).toContainText(
    "Move the existing lights beside each reading chair.",
  );
});
