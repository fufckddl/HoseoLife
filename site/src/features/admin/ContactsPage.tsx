import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { contactService } from '@/services/contactService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { 
  IoMailOutline,
  IoEyeOutline,
  IoCheckmarkCircleOutline,
  IoTimeOutline,
  IoRefreshOutline
} from 'react-icons/io5';

const ContactsPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const itemsPerPage = 10;

  // 문의 목록 조회
  const { data: contacts, isLoading, refetch } = useQuery({
    queryKey: ['admin-contacts', currentPage, statusFilter],
    queryFn: () => contactService.getAllContacts(currentPage * itemsPerPage, itemsPerPage),
    enabled: true
  });

  // 문의 통계 조회
  const { data: stats } = useQuery({
    queryKey: ['admin-contact-stats'],
    queryFn: () => contactService.getContactStats()
  });

  const handleViewContact = (contactId: number) => {
    navigate(`/admin/contacts/${contactId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <IoTimeOutline className="w-3 h-3 mr-1" />
            대기중
          </span>
        );
      case 'answered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <IoCheckmarkCircleOutline className="w-3 h-3 mr-1" />
            답변완료
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <IoMailOutline className="w-3 h-3 mr-1" />
            닫힘
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

  const getCategoryBadge = (category: string) => {
    const colors = {
      '기능 문의': 'bg-blue-100 text-blue-800',
      '버그 신고': 'bg-red-100 text-red-800',
      '개선 제안': 'bg-green-100 text-green-800',
      '기타': 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        colors[category as keyof typeof colors] || colors['기타']
      }`}>
        {category}
      </span>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">문의 관리</h1>
            <p className="text-gray-600 mt-2">
              사용자 문의를 검토하고 답변하세요.
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
                <IoMailOutline className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">전체 문의</p>
                <p className="text-xl font-semibold text-gray-900">{stats.total_contacts}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <IoTimeOutline className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">대기중</p>
                <p className="text-xl font-semibold text-gray-900">{stats.pending_contacts}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <IoCheckmarkCircleOutline className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">답변완료</p>
                <p className="text-xl font-semibold text-gray-900">{stats.answered_contacts}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <IoMailOutline className="w-5 h-5 text-gray-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">닫힘</p>
                <p className="text-xl font-semibold text-gray-900">
                  {stats.total_contacts - stats.pending_contacts - stats.answered_contacts}
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
                <option value="answered">답변완료</option>
                <option value="closed">닫힘</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 문의 목록 */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-gray-900">문의 목록</h2>
        </div>
        <div className="card-content">
          {contacts && contacts.length > 0 ? (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div key={contact.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">문의 #{contact.id}</h3>
                        {getStatusBadge(contact.status)}
                        {getCategoryBadge(contact.category)}
                      </div>
                      <div className="mb-2">
                        <h4 className="text-md font-medium text-gray-800">{contact.subject}</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">문의자 ID:</span> {contact.user_id}
                        </div>
                        <div>
                          <span className="font-medium">문의일:</span> {new Date(contact.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="font-medium text-sm text-gray-700">문의 내용:</span>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{contact.message}</p>
                      </div>
                      {contact.answer && (
                        <div className="mt-2">
                          <span className="font-medium text-sm text-gray-700">답변:</span>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{contact.answer}</p>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => handleViewContact(contact.id)}
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
              <IoMailOutline className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">문의가 없습니다.</p>
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
            disabled={!contacts || contacts.length < itemsPerPage}
            className="btn-outline btn-sm"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactsPage;
