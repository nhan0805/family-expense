import { lazy, Suspense } from 'react';
import { PageSkeleton } from './components/AsyncStates';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppProvider } from './context/AppContext';

const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })),
);
const Transactions = lazy(() =>
  import('./pages/Transactions').then((module) => ({
    default: module.Transactions,
  })),
);
const Budgets = lazy(() =>
  import('./pages/Budgets').then((module) => ({ default: module.Budgets })),
);
const TransactionForm = lazy(() =>
  import('./pages/TransactionForm').then((module) => ({
    default: module.TransactionForm,
  })),
);
const Catalogs = lazy(() =>
  import('./pages/Catalogs').then((module) => ({ default: module.Catalogs })),
);
const ImportExport = lazy(() =>
  import('./pages/ImportExport').then((module) => ({
    default: module.ImportExport,
  })),
);
const Login = lazy(() =>
  import('./pages/Login').then((module) => ({ default: module.Login })),
);
const ResetPassword = lazy(() =>
  import('./pages/ResetPassword').then((module) => ({
    default: module.ResetPassword,
  })),
);
const Members = lazy(() =>
  import('./pages/Members').then((module) => ({ default: module.Members })),
);
const CreateFamily = lazy(() =>
  import('./pages/CreateFamily').then((module) => ({
    default: module.CreateFamily,
  })),
);

const PageFallback = () => <PageSkeleton label="Đang tải trang…" />;

export function App() {
  return (
    <AppProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/dang-nhap" element={<Login />} />
          <Route path="/dat-lai-mat-khau" element={<ResetPassword />} />
          <Route path="/tao-gia-dinh" element={<CreateFamily />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/giao-dich" element={<Transactions />} />
            <Route path="/giao-dich/moi" element={<TransactionForm />} />
            <Route path="/giao-dich/:id" element={<TransactionForm />} />
            <Route path="/ngan-sach" element={<Budgets />} />
            <Route path="/danh-muc" element={<Catalogs />} />
            <Route path="/thanh-vien" element={<Members />} />
            <Route path="/du-lieu" element={<ImportExport />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppProvider>
  );
}
