import { expect, test } from '@playwright/test';

test('luồng đăng nhập và mở form giao dịch', async ({ page }) => {
  await page.goto('/dang-nhap');
  await expect(page.getByRole('heading', { name: /Đăng nhập/i })).toBeVisible();
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, 'Cần E2E_EMAIL và E2E_PASSWORD để chạy luồng cloud.');
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Mật khẩu').fill(password!);
  await page.getByRole('button', { name: /Đăng nhập/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/giao-dich/moi');
  await expect(page.getByLabel('Nội dung')).toBeVisible();
  await expect(page.getByLabel('Số tiền (VND)')).toBeVisible();
  await expect(page.getByLabel('Mục đích')).toBeVisible();
  await expect(page.getByLabel('Danh mục')).toBeVisible();
});
