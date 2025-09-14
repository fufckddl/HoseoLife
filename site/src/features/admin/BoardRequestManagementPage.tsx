import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { 
  IoCheckmarkCircleOutline, 
  IoCloseCircleOutline, 
  IoEyeOutline,
  IoTimeOutline,
  IoPersonOutline
} from 'react-icons/io5';

interface BoardRequest {
  id: number;
  name: string;
  description: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  creator_id: number;
  creator_name?: string;
}

const BoardRequestManagementPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<BoardRequest | null>(null);

  // 게시판 요청 목록 조회
  const { data: boardRequests = [], isLoading } = useQuery({
    queryKey: ['admin', 'board-requests'],
    queryFn: async () => {
      const response = await fetch('/api/admin/board-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!response.ok) throw new Error('게시판 요청 목록을 불러올 수 없습니다.');
      return response.json();
    }
  });

  // 게시판 요청 승인
  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/admin/board-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!response.ok) throw new Error('게시판 요청 승인에 실패했습니다.');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'board-requests'] });
      alert('게시판 요청이 승인되었습니다.');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      alert(error.message || '게시판 요청 승인에 실패했습니다.');
    }
  });

  // 게시판 요청 거부
  const rejectMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/admin/board-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!response.ok) throw new Error('게시판 요청 거부에 실패했습니다.');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'board-requests'] });
      alert('게시판 요청이 거부되었습니다.');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      alert(error.message || '게시판 요청 거부에 실패했습니다.');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <IoTimeOutline className="w-3 h-3 mr-1" />
          대기중
        </span>;
      case 'approved':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <IoCheckmarkCircleOutline className="w-3 h-3 mr-1" />
          승인됨
        </span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <IoCloseCircleOutline className="w-3 h-3 mr-1" />
          거부됨
        </span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {status}
        </span>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // UTC 시간을 한국 시간(UTC+9)으로 변환
    const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    
    return koreaTime.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul'
    });
  };

  if (!user?.is_admin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">접근 권한이 없습니다</h2>
          <p className="text-gray-600">관리자만 접근할 수 있는 페이지입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">게시판 생성 관리</h1>
        <p className="text-gray-600">사용자들이 요청한 게시판 생성을 승인하거나 거부할 수 있습니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <IoTimeOutline className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">대기중</p>
              <p className="text-2xl font-bold text-gray-900">
                {boardRequests.filter((req: BoardRequest) => req.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <IoCheckmarkCircleOutline className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">승인됨</p>
              <p className="text-2xl font-bold text-gray-900">
                {boardRequests.filter((req: BoardRequest) => req.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <IoCloseCircleOutline className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">거부됨</p>
              <p className="text-2xl font-bold text-gray-900">
                {boardRequests.filter((req: BoardRequest) => req.status === 'rejected').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 게시판 요청 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">게시판 요청 목록</h2>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">로딩 중...</p>
          </div>
        ) : boardRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>게시판 요청이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    게시판명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    설명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    요청자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    요청일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {boardRequests.map((request: BoardRequest) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{request.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">{request.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <IoPersonOutline className="w-4 h-4 mr-1" />
                        {request.creator_name || `사용자 ${request.creator_id}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <IoEyeOutline className="w-4 h-4" />
                        </button>
                        {request.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveMutation.mutate(request.id)}
                              disabled={approveMutation.isPending}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              <IoCheckmarkCircleOutline className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate(request.id)}
                              disabled={rejectMutation.isPending}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              <IoCloseCircleOutline className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">게시판 요청 상세</h3>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <IoCloseCircleOutline className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">게시판명</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRequest.name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">설명</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedRequest.description}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">요청자</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedRequest.creator_name || `사용자 ${selectedRequest.creator_id}`}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">요청일</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(selectedRequest.created_at)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">상태</label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>
              
              {selectedRequest.status === 'pending' && (
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      rejectMutation.mutate(selectedRequest.id);
                    }}
                    disabled={rejectMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    거부
                  </button>
                  <button
                    onClick={() => {
                      approveMutation.mutate(selectedRequest.id);
                    }}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    승인
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardRequestManagementPage;
