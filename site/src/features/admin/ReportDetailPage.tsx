import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportService } from '@/services/reportService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { 
  IoArrowBackOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoWarningOutline,
  IoPersonOutline,
  IoDocumentTextOutline,
  IoChatbubbleOutline
} from 'react-icons/io5';

const ReportDetailPage: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adminResponse, setAdminResponse] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 신고 상세 조회
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['admin-report-detail', reportId],
    queryFn: () => reportService.getReport(Number(reportId)),
    enabled: !!reportId
  });

  // 신고 처리 mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ status, response }: { status: string; response?: string }) => {
      const response_data = await fetch(`https://hoseolife.kro.kr/reports/admin/${reportId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          admin_response: response
        })
      });
      
      if (!response_data.ok) {
        throw new Error('신고 처리에 실패했습니다.');
      }
      
      return response_data.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-report-detail', reportId] });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-stats'] });
      setIsProcessing(false);
      setAdminResponse('');
      setSelectedStatus('');
      alert('신고가 성공적으로 처리되었습니다.');
    },
    onError: (error) => {
      console.error('신고 처리 실패:', error);
      alert('신고 처리에 실패했습니다.');
      setIsProcessing(false);
    }
  });

  const handleApprove = () => {
    if (!adminResponse.trim()) {
      alert('관리자 답변을 입력해주세요.');
      return;
    }
    
    if (window.confirm('이 신고를 승인하시겠습니까?')) {
      setIsProcessing(true);
      updateReportMutation.mutate({
        status: 'approved',
        response: adminResponse
      });
    }
  };

  const handleReject = () => {
    if (!adminResponse.trim()) {
      alert('관리자 답변을 입력해주세요.');
      return;
    }
    
    if (window.confirm('이 신고를 거부하시겠습니까?')) {
      setIsProcessing(true);
      updateReportMutation.mutate({
        status: 'rejected',
        response: adminResponse
      });
    }
  };

  const handleStatusChange = () => {
    if (!selectedStatus) {
      alert('상태를 선택해주세요.');
      return;
    }
    
    if (window.confirm(`신고 상태를 "${selectedStatus === 'approved' ? '승인' : selectedStatus === 'rejected' ? '거부' : '대기중'}"로 변경하시겠습니까?`)) {
      setIsProcessing(true);
      updateReportMutation.mutate({
        status: selectedStatus,
        response: adminResponse || undefined
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <IoWarningOutline className="w-4 h-4 mr-1" />
            대기중
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <IoCheckmarkCircleOutline className="w-4 h-4 mr-1" />
            승인됨
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <IoCloseCircleOutline className="w-4 h-4 mr-1" />
            거부됨
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getTargetTypeIcon = (type: string) => {
    switch (type) {
      case 'post':
        return <IoDocumentTextOutline className="w-5 h-5" />;
      case 'comment':
        return <IoChatbubbleOutline className="w-5 h-5" />;
      case 'user':
        return <IoPersonOutline className="w-5 h-5" />;
      default:
        return <IoWarningOutline className="w-5 h-5" />;
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

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-8">
          <p className="text-red-600">신고를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/admin/reports')}
            className="btn-primary mt-4"
          >
            신고 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => navigate('/admin/reports')}
            className="btn-outline flex items-center space-x-2"
          >
            <IoArrowBackOutline className="w-4 h-4" />
            <span>목록으로</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">신고 상세</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-lg text-gray-600">신고 #{report.id}</span>
          {getStatusBadge(report.status)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 신고 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 기본 정보 */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">신고 정보</h2>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">신고 유형</label>
                  <div className="flex items-center space-x-2">
                    {getTargetTypeIcon(report.target_type)}
                    <span className="text-gray-900">{getTargetTypeText(report.target_type)}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">신고 대상 ID</label>
                  <span className="text-gray-900">{report.target_id}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">신고자</label>
                  <span className="text-gray-900">{report.reporter_nickname || '알 수 없음'}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">신고일</label>
                  <span className="text-gray-900">{new Date(report.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 신고 사유 */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">신고 사유</h2>
            </div>
            <div className="card-content">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">신고 유형</label>
                <p className="text-gray-900 font-medium">{report.reason}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">상세 설명</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{report.reason}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 관리자 처리 */}
          {report.status === 'pending' && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-900">신고 처리</h2>
              </div>
              <div className="card-content">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    관리자 답변 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder="신고 처리 결과에 대한 답변을 입력하세요..."
                    className="textarea w-full"
                    rows={4}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleApprove}
                    disabled={isProcessing || !adminResponse.trim()}
                    className="btn-success flex items-center space-x-2"
                  >
                    <IoCheckmarkCircleOutline className="w-4 h-4" />
                    <span>승인</span>
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={isProcessing || !adminResponse.trim()}
                    className="btn-error flex items-center space-x-2"
                  >
                    <IoCloseCircleOutline className="w-4 h-4" />
                    <span>거부</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 상태 변경 */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">상태 관리</h2>
            </div>
            <div className="card-content">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상태 변경
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="input w-full"
                >
                  <option value="">상태를 선택하세요</option>
                  <option value="pending">대기중</option>
                  <option value="approved">승인</option>
                  <option value="rejected">거부</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  관리자 답변 (선택사항)
                </label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="상태 변경과 함께 답변을 추가할 수 있습니다..."
                  className="textarea w-full"
                  rows={4}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleStatusChange}
                  disabled={isProcessing || !selectedStatus}
                  className="btn-primary flex items-center space-x-2"
                >
                  <IoCheckmarkCircleOutline className="w-4 h-4" />
                  <span>상태 변경</span>
                </button>
              </div>
            </div>
          </div>

          {/* 처리 결과 */}
          {report.status !== 'pending' && report.admin_response && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-900">처리 결과</h2>
              </div>
              <div className="card-content">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">처리 상태</label>
                  {getStatusBadge(report.status)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">관리자 답변</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">{report.admin_response}</p>
                  </div>
                </div>
                {report.processed_at && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">처리일</label>
                    <span className="text-gray-900">{new Date(report.processed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 사이드바 */}
        <div className="space-y-6">
          {/* 신고 대상 링크 */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">신고 대상</h3>
            </div>
            <div className="card-content">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  {getTargetTypeIcon(report.target_type)}
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {getTargetTypeText(report.target_type)} #{report.target_id}
                </p>
                <button
                  onClick={() => {
                    if (report.target_type === 'post') {
                      navigate(`/post/${report.target_id}`);
                    } else if (report.target_type === 'comment') {
                      // 댓글이 있는 게시글로 이동 (실제 구현 필요)
                      alert('댓글이 있는 게시글로 이동합니다.');
                    } else {
                      alert('사용자 프로필로 이동합니다.');
                    }
                  }}
                  className="btn-outline btn-sm w-full"
                >
                  대상 보기
                </button>
              </div>
            </div>
          </div>

          {/* 신고자 정보 */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">신고자</h3>
            </div>
            <div className="card-content">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <IoPersonOutline className="w-6 h-6 text-gray-600" />
                </div>
                <p className="font-medium text-gray-900">{report.reporter_nickname || '알 수 없음'}</p>
                <p className="text-sm text-gray-600">신고자 ID: {report.reporter_id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetailPage;
