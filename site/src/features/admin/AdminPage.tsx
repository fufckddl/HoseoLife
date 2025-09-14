import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { reportService } from '@/services/reportService';
import { contactService } from '@/services/contactService';
import { postService } from '@/services/postService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { 
  IoPeopleOutline, 
  IoDocumentTextOutline, 
  IoChatbubblesOutline, 
  IoWarningOutline,
  IoEyeOutline
} from 'react-icons/io5';

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 통계 데이터 조회
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => postService.getStats(),
    enabled: !!user
  });

  // 신고 통계 조회
  const { data: reportStats, isLoading: reportStatsLoading } = useQuery({
    queryKey: ['admin-report-stats'],
    queryFn: () => reportService.getReportStats(),
    enabled: !!user
  });

  // 문의 통계 조회 (현재 사용하지 않음)
  // const { data: contactStats, isLoading: contactStatsLoading } = useQuery({
  //   queryKey: ['admin-contact-stats'],
  //   queryFn: () => contactService.getContactStats(),
  //   enabled: !!user
  // });

  // 최근 신고 목록 조회
  const { data: recentReports, isLoading: reportsLoading } = useQuery({
    queryKey: ['admin-recent-reports'],
    queryFn: () => reportService.getAllReports(0, 5),
    enabled: !!user
  });

  // 최근 문의 목록 조회
  const { data: recentContacts, isLoading: contactsLoading } = useQuery({
    queryKey: ['admin-recent-contacts'],
    queryFn: () => contactService.getAllContacts(0, 5),
    enabled: !!user
  });

  if (statsLoading || reportStatsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="text-gray-600 mt-2">
          안녕하세요, {user?.nickname}님. 관리자 페이지입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <IoPeopleOutline className="w-6 h-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">활성 사용자</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.active_users || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
              <IoDocumentTextOutline className="w-6 h-6 text-secondary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">총 게시글</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.total_posts || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
              <IoChatbubblesOutline className="w-6 h-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">총 댓글</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.total_comments || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center">
              <IoWarningOutline className="w-6 h-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">대기 중인 신고</p>
              <p className="text-2xl font-semibold text-gray-900">
                {reportStats?.pending_reports || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-xl font-semibold text-gray-900">최근 신고</h2>
          </div>
          <div className="card-content">
            {reportsLoading ? (
              <LoadingSpinner />
            ) : recentReports && recentReports.length > 0 ? (
              <div className="space-y-4">
                {recentReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">신고 #{report.id}</p>
                      <p className="text-xs text-gray-600">
                        {report.target_type === 'post' ? '게시글' : 
                         report.target_type === 'comment' ? '댓글' : '사용자'} 신고
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        신고자: {report.reporter_nickname || '알 수 없음'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`badge ${
                        report.status === 'pending' ? 'badge-warning' :
                        report.status === 'approved' ? 'badge-success' : 'badge-error'
                      }`}>
                        {report.status === 'pending' ? '대기중' :
                         report.status === 'approved' ? '승인됨' : '거부됨'}
                      </span>
                      <button
                        onClick={() => navigate(`/admin/reports/${report.id}`)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="상세보기"
                      >
                        <IoEyeOutline className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">신고가 없습니다.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-xl font-semibold text-gray-900">최근 문의</h2>
          </div>
          <div className="card-content">
            {contactsLoading ? (
              <LoadingSpinner />
            ) : recentContacts && recentContacts.length > 0 ? (
              <div className="space-y-4">
                {recentContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">문의 #{contact.id}</p>
                      <p className="text-xs text-gray-600">{contact.subject}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        문의자 ID: {contact.user_id}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`badge ${
                        contact.status === 'pending' ? 'badge-warning' :
                        contact.status === 'answered' ? 'badge-success' : 'badge-info'
                      }`}>
                        {contact.status === 'pending' ? '대기중' :
                         contact.status === 'answered' ? '답변완료' : contact.status}
                      </span>
                      <button
                        onClick={() => navigate(`/admin/contacts/${contact.id}`)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="상세보기"
                      >
                        <IoEyeOutline className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">문의가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

