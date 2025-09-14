import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactService } from '@/services/contactService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { 
  IoArrowBackOutline,
  IoCheckmarkCircleOutline,
  IoMailOutline,
  IoTimeOutline,
  IoPersonOutline,
  IoSendOutline
} from 'react-icons/io5';

const ContactDetailPage: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adminResponse, setAdminResponse] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 문의 상세 조회
  const { data: contact, isLoading, error } = useQuery({
    queryKey: ['admin-contact-detail', contactId],
    queryFn: () => contactService.getContact(Number(contactId)),
    enabled: !!contactId
  });

  // 문의 답변/상태 변경 mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ response, status }: { response?: string; status: string }) => {
      const response_data = await fetch(`https://hoseolife.kro.kr/contacts/admin/${contactId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_response: response,
          status: status
        })
      });
      
      if (!response_data.ok) {
        throw new Error('문의 업데이트에 실패했습니다.');
      }
      
      return response_data.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contact-detail', contactId] });
      queryClient.invalidateQueries({ queryKey: ['admin-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-contact-stats'] });
      setIsProcessing(false);
      setAdminResponse('');
      setSelectedStatus('');
      alert('문의가 성공적으로 업데이트되었습니다.');
    },
    onError: (error) => {
      console.error('문의 업데이트 실패:', error);
      alert('문의 업데이트에 실패했습니다.');
      setIsProcessing(false);
    }
  });

  const handleAnswer = () => {
    if (!adminResponse.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }
    
    if (window.confirm('이 문의에 답변을 전송하시겠습니까?')) {
      setIsProcessing(true);
      updateContactMutation.mutate({
        response: adminResponse,
        status: 'answered'
      });
    }
  };

  const handleStatusChange = () => {
    if (!selectedStatus) {
      alert('상태를 선택해주세요.');
      return;
    }
    
    if (window.confirm(`문의 상태를 "${selectedStatus === 'answered' ? '답변완료' : selectedStatus === 'closed' ? '닫힘' : '대기중'}"로 변경하시겠습니까?`)) {
      setIsProcessing(true);
      updateContactMutation.mutate({
        response: adminResponse || undefined,
        status: selectedStatus
      });
    }
  };

  const handleClose = () => {
    if (window.confirm('이 문의를 닫으시겠습니까?')) {
      setIsProcessing(true);
      updateContactMutation.mutate({
        response: adminResponse || '문의가 관리자에 의해 닫혔습니다.',
        status: 'closed'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <IoTimeOutline className="w-4 h-4 mr-1" />
            대기중
          </span>
        );
      case 'answered':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <IoCheckmarkCircleOutline className="w-4 h-4 mr-1" />
            답변완료
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            <IoMailOutline className="w-4 h-4 mr-1" />
            닫힘
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

  const getCategoryBadge = (category: string) => {
    const colors = {
      '기능 문의': 'bg-blue-100 text-blue-800',
      '버그 신고': 'bg-red-100 text-red-800',
      '개선 제안': 'bg-green-100 text-green-800',
      '기타': 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
        colors[category as keyof typeof colors] || colors['기타']
      }`}>
        {category}
      </span>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !contact) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-8">
          <p className="text-red-600">문의를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/admin/contacts')}
            className="btn-primary mt-4"
          >
            문의 목록으로 돌아가기
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
            onClick={() => navigate('/admin/contacts')}
            className="btn-outline flex items-center space-x-2"
          >
            <IoArrowBackOutline className="w-4 h-4" />
            <span>목록으로</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">문의 상세</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-lg text-gray-600">문의 #{contact.id}</span>
          {getStatusBadge(contact.status)}
          {getCategoryBadge(contact.category)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 문의 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 기본 정보 */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">문의 정보</h2>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">문의자 ID</label>
                  <span className="text-gray-900">{contact.user_id}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  {getCategoryBadge(contact.category)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">문의일</label>
                  <span className="text-gray-900">{new Date(contact.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                  {getStatusBadge(contact.status)}
                </div>
              </div>
            </div>
          </div>

          {/* 문의 내용 */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">문의 내용</h2>
            </div>
            <div className="card-content">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                <h3 className="text-lg font-medium text-gray-900">{contact.subject}</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{contact.message}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 기존 답변 */}
          {contact.answer && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-900">기존 답변</h2>
              </div>
              <div className="card-content">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{contact.answer}</p>
                </div>
                {contact.answered_at && (
                  <div className="mt-4 text-sm text-gray-600">
                    답변일: {new Date(contact.answered_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 답변 작성 */}
          {contact.status === 'pending' && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-900">답변 작성</h2>
              </div>
              <div className="card-content">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    답변 내용 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder="문의에 대한 답변을 입력하세요..."
                    className="textarea w-full"
                    rows={6}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleAnswer}
                    disabled={isProcessing || !adminResponse.trim()}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <IoSendOutline className="w-4 h-4" />
                    <span>답변 전송</span>
                  </button>
                  <button
                    onClick={handleClose}
                    disabled={isProcessing}
                    className="btn-outline"
                  >
                    문의 닫기
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
                  <option value="answered">답변완료</option>
                  <option value="closed">닫힘</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  답변 내용 (선택사항)
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

          {/* 답변 수정 */}
          {contact.status === 'answered' && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-900">답변 수정</h2>
              </div>
              <div className="card-content">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    수정할 답변 내용
                  </label>
                  <textarea
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder="수정할 답변 내용을 입력하세요..."
                    className="textarea w-full"
                    rows={6}
                    defaultValue={contact.answer || ''}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      if (!adminResponse.trim()) {
                        alert('답변 내용을 입력해주세요.');
                        return;
                      }
                      setIsProcessing(true);
                      updateContactMutation.mutate({
                        response: adminResponse,
                        status: 'answered'
                      });
                    }}
                    disabled={isProcessing}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <IoSendOutline className="w-4 h-4" />
                    <span>답변 수정</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 사이드바 */}
        <div className="space-y-6">
          {/* 문의자 정보 */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">문의자</h3>
            </div>
            <div className="card-content">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <IoPersonOutline className="w-6 h-6 text-gray-600" />
                </div>
                <p className="font-medium text-gray-900">사용자 ID: {contact.user_id}</p>
                <p className="text-sm text-gray-600">문의자</p>
              </div>
            </div>
          </div>

          {/* 문의 통계 */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">문의 정보</h3>
            </div>
            <div className="card-content">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">문의일</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(contact.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">수정일</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(contact.updated_at).toLocaleDateString()}
                  </span>
                </div>
                {contact.answered_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">답변일</span>
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(contact.answered_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailPage;
