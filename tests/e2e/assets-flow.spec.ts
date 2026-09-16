import { expect, test } from '@playwright/test';

test('luồng demo thêm và bán vàng', async ({ page }) => {
  await page.goto('/tai-san');
  const loginHeading = page.getByRole('heading', { name: /Đăng nhập/i });
  const assetsHeading = page.getByRole('heading', { name: /^Tài sản$/i });
  await expect(loginHeading.or(assetsHeading)).toBeVisible();
  if (await loginHeading.isVisible()) {
    test.skip(true, 'Môi trường E2E đang trỏ tới Supabase; bỏ qua luồng demo local.');
  }

  await expect(assetsHeading).toBeVisible();
  await page.getByLabel('Giá tiệm mua vào dùng chung / chỉ (VND)').fill('8500000');
  await page.getByRole('button', { name: 'Lưu giá dùng chung' }).click();
  await expect(page.getByText('Đã lưu giá tiệm mua vào dùng chung.')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm vàng' }).first().click();
  await page.getByLabel('Số lượng (chỉ)').fill('1.5');
  await page.getByLabel('Giá mua / chỉ (VND)').fill('8000000');
  await page.getByRole('button', { name: 'Lưu vàng' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Tạo và ghi giao dịch' }).click();
  await expect(page.getByText('Đã lưu vàng.')).toBeVisible();
  await expect(page.getByText(/1,5 \/ 1,5 chỉ/)).toBeVisible();

  await page.getByRole('button', { name: 'Bán vàng' }).click();
  await page.getByLabel('Số lượng (chỉ)').fill('0.5');
  await page.getByLabel('Giá bán / chỉ (VND)').fill('9000000');
  await page.getByRole('button', { name: 'Bán và ghi thu nhập' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Bán và ghi nhận' }).click();
  await expect(page.getByText('Đã ghi nhận bán vàng.')).toBeVisible();
  await expect(page.getByText(/1 \/ 1,5 chỉ/)).toBeVisible();
});
