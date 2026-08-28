# Thiết lập bảo vệ nhánh `main`

Trong GitHub vào **Settings → Branches → Add branch protection rule** cho `main`:

- Bắt buộc pull request trước khi merge.
- Bắt buộc 1 người review.
- Bắt buộc status check `quality` thành công.
- Bắt buộc branch cập nhật với `main` trước khi merge.
- Không cho force-push hoặc xoá nhánh.
- Chỉ maintainer được merge.

