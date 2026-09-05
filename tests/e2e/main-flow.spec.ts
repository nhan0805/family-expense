import { expect, test } from '@playwright/test';

test('luồng demo mở danh sách và form giao dịch', async ({ page }) => {
  await page.goto('/');
  const loginHeading = page.getByRole('heading', { name: /Đăng nhập/i });
  const dashboardHeading = page.getByRole('heading', { name: /Tổng quan tài chính/i });
  await expect(loginHeading.or(dashboardHeading)).toBeVisible();
  if (await loginHeading.isVisible()) {
    test.skip(true, 'Môi trường E2E đang trỏ tới Supabase; dùng luồng cloud bên dưới khi có credential.');
  }
  await expect(dashboardHeading).toBeVisible();
  await page.getByRole('link', { name: /Giao dịch/i }).first().click();
  await expect(page.getByRole('heading', { name: /^Giao dịch$/i })).toBeVisible();
  await page.getByRole('link', { name: /Thêm giao dịch/i }).first().click();
  await expect(page.getByRole('heading', { name: /Thêm giao dịch/i })).toBeVisible();
  await page.getByLabel('Nội dung').fill('Kiểm tra luồng demo');
  await page.getByLabel('Số tiền (VND)').fill('100000');
  await page.getByLabel('Mục đích').selectOption({ index: 1 });
  await page.getByLabel('Danh mục').selectOption({ index: 1 });
  await page.getByLabel('Phương thức thanh toán').selectOption({ index: 1 });
  await page.getByRole('button', { name: /Xác nhận và lưu/i }).click();
  await expect(page).toHaveURL(/\/giao-dich$/);
  await expect(page.getByText('Kiểm tra luồng demo')).toBeVisible();
});

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
