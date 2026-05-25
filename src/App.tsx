import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QuestionBankProvider, QuestionProvider } from './contexts';
import Layout from './components/Layout';
import TitleBar from './components/TitleBar';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ManualEntry = lazy(() => import('./pages/ManualEntry'));
const CsvImport = lazy(() => import('./pages/CsvImport'));
const AiImport = lazy(() => import('./pages/AiImport'));
const Practice = lazy(() => import('./pages/Practice'));
const WrongBook = lazy(() => import('./pages/WrongBook'));
const QuestionPreview = lazy(() => import('./pages/QuestionPreview'));
const Settings = lazy(() => import('./pages/Settings'));
const AiChat = lazy(() => import('./pages/AiChat'));

const PageFallback = () => (
  <div className="flex min-h-[320px] items-center justify-center text-sm font-semibold text-gray-400 dark:text-gray-500">
    页面加载中...
  </div>
);

const lazyRoute = (Component: React.ComponentType) => (
  <Suspense fallback={<PageFallback />}>
    <Component />
  </Suspense>
);

function App() {
  return (
    <div className="h-dvh overflow-hidden rounded-xl bg-canvas dark:bg-gray-900 flex flex-col">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        <QuestionBankProvider>
          <QuestionProvider>
            <Router>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={lazyRoute(Dashboard)} />
                  <Route path="manual-entry" element={lazyRoute(ManualEntry)} />
                  <Route path="csv-import" element={lazyRoute(CsvImport)} />
                  <Route path="ai-import" element={lazyRoute(AiImport)} />
                  <Route path="practice" element={lazyRoute(Practice)} />
                  <Route path="wrong-book" element={lazyRoute(WrongBook)} />
                  <Route path="question-preview" element={lazyRoute(QuestionPreview)} />
                  <Route path="ai-chat" element={lazyRoute(AiChat)} />
                  <Route path="settings" element={lazyRoute(Settings)} />
                </Route>
              </Routes>
            </Router>
          </QuestionProvider>
        </QuestionBankProvider>
      </div>
    </div>
  );
}

export default App;
