import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reportService } from '@/services/reportService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { 
  IoWarningOutline,
  IoEyeOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoRefreshOutline
} from 'react-icons/io5';

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const itemsPerPage = 10;

  // 신고 목록 조회
  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['admin-reports', currentPage, statusFilter],
    queryFn: () => reportService.getAllReports(currentPage * itemsPerPage, itemsPerPage),
    enabled: true
  });

  // 신고 통계 조회
  const { data: stats } = useQuery({
    queryKey: ['admin-report-stats'],
    queryFn: () => reportService.getReportStats()
  });

  const handleViewReport = (reportId: number) => {
    navigate(`/admin/reports/${reportId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <IoWarningOutline className="w-3 h-3 mr-1" />
            대기중
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <IoCheckmarkCircleOutline className="w-3 h-3 mr-1" />
            승인됨
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <IoCloseCircleOutline className="w-3 h-3 mr-1" />
            거부됨
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getTargetTypeText = (type: string) => {
    switch (type) {
      case 'post':
        return '게시글';
      case 'comment':
        return '댓글';
      case 'user':
        return '사용자';
      default:
        return type;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">신고 관리</h1>
            <p className="text-gray-600 mt-2">
              사용자 신고를 검토하고 처리하세요.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-outline flex items-center space-x-2"
          >
            <IoRefreshOutline className="w-4 h-4" />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <IoWarningOutline className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">전체 신고</p>
                <p className="text-xl font-semibold text-gray-900">{stats.total_reports}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <IoWarningOutline className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">대기중</p>
                <p className="text-xl font-semibold text-gray-900">{stats.pending_reports}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <IoCheckmarkCircleOutline className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">처리완료</p>
                <p className="text-xl font-semibold text-gray-900">{stats.resolved_reports}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <IoCloseCircleOutline className="w-5 h-5 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">거부됨</p>
                <p className="text-xl font-semibold text-gray-900">
                  {stats.total_reports - stats.pending_reports - stats.resolved_reports}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 필터 및 검색 */}
      <div className="card mb-6">
        <div className="card-content">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">상태:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select select-sm"
              >
                <option value="all">전체</option>
                <option value="pending">대기중</option>
                <option value="approved">승인됨</option>
                <option value="rejected">거부됨</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 신고 목록 */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-gray-900">신고 목록</h2>
        </div>
        <div className="card-content">
          {reports && reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">신고 #{report.id}</h3>
                        {getStatusBadge(report.status)}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">신고 유형:</span> {getTargetTypeText(report.target_type)}
                        </div>
                        <div>
                          <span className="font-medium">신고자:</span> {report.reporter_nickname || '알 수 없음'}
                        </div>
                        <div>
                          <span className="font-medium">신고일:</span> {new Date(report.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="font-medium text-sm text-gray-700">신고 사유:</span>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{report.reason}</p>
                      </div>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => handleViewReport(report.id)}
                        className="btn-primary btn-sm flex items-center space-x-2"
                      >
                        <IoEyeOutline className="w-4 h-4" />
                        <span>상세보기</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <IoWarningOutline className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">신고가 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 페이지네이션 */}
      <div className="flex justify-center mt-6">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="btn-outline btn-sm"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            페이지 {currentPage + 1}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!reports || reports.length < itemsPerPage}
            className="btn-outline btn-sm"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
