import { expect, test } from '@playwright/test';

test('luồng demo thêm và bán vàng', async ({ page }) => {
  await page.goto('/tai-san');
  const loginHeading = page.getByRole('heading', { name: /Đăng nhập/i });
  const assetsHeading = page.getByRole('heading', { name: /^Tài sản$/i });
  await expect(loginHeading.or(assetsHeading)).toBeVisible();
  if (await loginHeading.isVisible()) {
    test.skip(true, 'Môi trường E2E đang trỏ tới Supabase; bỏ qua luồng demo local.');
  }

  await page.getByRole('tab', { name: 'Vàng' }).click();
  const goldSection = page.getByRole('region', { name: 'Vàng' });
  const sellButton = goldSection.getByRole('button', { name: 'Bán vàng' });
  const addButton = goldSection.getByRole('button', { name: 'Thêm vàng' }).first();
  const [sellBox, addBox] = await Promise.all([sellButton.boundingBox(), addButton.boundingBox()]);
  expect(sellBox?.width).toBeCloseTo(addBox?.width, 1);

  await page.goto('/cai-dat');
  await expect(page.getByRole('heading', { name: /^Cài đặt$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bộ lọc giao dịch mặc định' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Bộ lọc mặc định' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Giao dịch tự động' }).click();
  await expect(page.getByRole('heading', { name: 'Mặc định giao dịch tự động' })).toBeVisible();
  await page.locator('#gold_sale-payment-method').selectOption({ label: 'Chuyển khoản' });
  await page.getByRole('button', { name: 'Lưu mặc định tự động' }).click();
  await expect(page.getByText('Đã lưu cấu hình giao dịch tự động.')).toBeVisible();

  await page.goto('/tai-san');
  await expect(assetsHeading).toBeVisible();
  await page.getByRole('tab', { name: 'Vàng' }).click();
  await page.getByLabel('Giá tiệm mua vào dùng chung / chỉ (VND)').fill('8500000');
  await page.getByRole('button', { name: 'Lưu giá dùng chung' }).click();
  await expect(page.getByText('Đã lưu giá tiệm mua vào dùng chung.')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm vàng' }).first().click();
  await page.getByLabel('Số lượng (chỉ)').fill('1.5');
  await page.getByLabel('Giá mua / chỉ (VND)').fill('8000000');
  await page.getByRole('button', { name: 'Lưu vàng' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Tạo và ghi giao dịch' }).click();
  await expect(page.getByText('Đã lưu vàng.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1,5 chỉ', level: 4 })).toBeVisible();

  await page.getByRole('button', { name: 'Bán vàng' }).click();
  await page.getByLabel('Số lượng (chỉ)').fill('0.5');
  await page.getByLabel('Giá bán / chỉ (VND)').fill('9000000');
  await page.getByRole('button', { name: 'Bán và ghi thu nhập' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Bán và ghi nhận' }).click();
  await expect(page.getByText('Đã ghi nhận bán vàng.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 chỉ', level: 4 })).toBeVisible();

  await page.getByRole('button', { name: 'Xóa' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('các giao dịch được tự tạo cho lô này');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa vàng' }).click();
  await expect(page.getByText('Đã xóa vàng.')).toBeVisible();
  await expect(page.getByText('Chưa có vàng')).toBeVisible();
});
