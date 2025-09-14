import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';


// Providers
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProtectedRoute, GuestRoute, AdminRoute } from '@/features/auth/ProtectedRoute';

// Pages
import LoginPage from '@/features/auth/LoginPage';
import SignupPage from '@/features/auth/SignupPage';
import HomePage from '@/features/posts/HomePage';
import PostsPage from '@/features/posts/PostsPage';
import PostDetailPage from '@/features/posts/PostDetailPage';
import CreatePostPage from '@/features/posts/CreatePostPage';
import EditPostPage from '@/features/posts/EditPostPage';
import BoardListPage from '@/features/boards/BoardListPage';
import CreateBoardPage from '@/features/boards/CreateBoardPage';
import ProfilePage from '@/features/profile/ProfilePage';
import AdminPage from '@/features/admin/AdminPage';
import ReportsPage from '@/features/admin/ReportsPage';
import ReportDetailPage from '@/features/admin/ReportDetailPage';
import ContactsPage from '@/features/admin/ContactsPage';
import ContactDetailPage from '@/features/admin/ContactDetailPage';
import BoardRequestManagementPage from '@/features/admin/BoardRequestManagementPage';
import GroupChatRequestManagementPage from '@/features/admin/GroupChatRequestManagementPage';
import { BookmarkPage } from '@/features/bookmarks/BookmarkPage';
import MyHeartsPage from '@/features/posts/MyHeartsPage';
import { SearchPage } from '@/features/search/SearchPage';
import { ReportPage } from '@/features/reports/ReportPage';
import ContactPage from '@/features/contact/ContactPage';

// Components
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

// Query Client
import { queryClient } from '@/lib/queryClient';

// 메인 App 컴포넌트
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router basename="/web">
            <div className="App">
              <Routes>
                {/* 인증 관련 라우트 (비인증 사용자만 접근) */}
                <Route
                  path="/login"
                  element={
                    <GuestRoute>
                      <LoginPage />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <GuestRoute>
                      <SignupPage />
                    </GuestRoute>
                  }
                />

                {/* 메인 라우트 (인증된 사용자만 접근) */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <HomePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 게시판 관련 라우트 */}
                <Route
                  path="/boards"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <BoardListPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/boards/create"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CreateBoardPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 게시글 관련 라우트 */}
                <Route
                  path="/posts"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PostsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/posts/:postId"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PostDetailPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/write"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CreatePostPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/edit/:postId"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <EditPostPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 프로필 라우트 */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ProfilePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 북마크 라우트 */}
                <Route
                  path="/bookmarks"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <BookmarkPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/hearts"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <MyHeartsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 검색 라우트 */}
                <Route
                  path="/search"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <SearchPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 신고 라우트 */}
                <Route
                  path="/report"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ReportPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 문의 라우트 */}
                <Route
                  path="/contact"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ContactPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 관리자 라우트 */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <Layout>
                        <AdminPage />
                      </Layout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <AdminRoute>
                      <Layout>
                        <ReportsPage />
                      </Layout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/reports/:reportId"
                  element={
                    <AdminRoute>
                      <Layout>
                        <ReportDetailPage />
                      </Layout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/contacts"
                  element={
                    <AdminRoute>
                      <Layout>
                        <ContactsPage />
                      </Layout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/contacts/:contactId"
                  element={
                    <AdminRoute>
                      <Layout>
                        <ContactDetailPage />
                      </Layout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/board-requests"
                  element={
                    <AdminRoute>
                      <Layout>
                        <BoardRequestManagementPage />
                      </Layout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/group-chat-requests"
                  element={
                    <AdminRoute>
                      <Layout>
                        <GroupChatRequestManagementPage />
                      </Layout>
                    </AdminRoute>
                  }
                />

                {/* 404 페이지 */}
                <Route
                  path="/404"
                  element={
                    <div className="min-h-screen flex items-center justify-center">
                      <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                        <p className="text-gray-600 mb-6">페이지를 찾을 수 없습니다.</p>
                        <button
                          onClick={() => window.history.back()}
                          className="btn-primary"
                        >
                          이전 페이지로
                        </button>
      </div>
      </div>
                  }
                />

                {/* 기본 리다이렉트 */}
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </div>
          </Router>

          {/* React Query DevTools 비활성화 */}
          {/* {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />} */}
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;