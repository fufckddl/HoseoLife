import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { 
  IoHomeOutline, 
  IoCreateOutline, 
  IoSearchOutline, 
  IoBookmarkOutline, 
  IoHeartOutline,
  IoPersonOutline, 
  IoSettingsOutline,
  IoWarningOutline,
  IoMailOutline
} from 'react-icons/io5';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const navigation = [
    { name: '홈', href: '/', icon: <IoHomeOutline className="w-5 h-5" /> },
    { name: '게시글 작성', href: '/write', icon: <IoCreateOutline className="w-5 h-5" /> },
    { name: '검색', href: '/search', icon: <IoSearchOutline className="w-5 h-5" /> },
    { name: '좋아요', href: '/hearts', icon: <IoHeartOutline className="w-5 h-5" /> },
    { name: '북마크', href: '/bookmarks', icon: <IoBookmarkOutline className="w-5 h-5" /> },
    { name: '프로필', href: '/profile', icon: <IoPersonOutline className="w-5 h-5" /> },
  ];

  const adminNavigation = [
    { name: '관리자', href: '/admin', icon: <IoSettingsOutline className="w-5 h-5" /> },
    { name: '게시판 생성 관리', href: '/admin/board-requests', icon: <IoCreateOutline className="w-5 h-5" /> },
    { name: '그룹 채팅방 생성 관리', href: '/admin/group-chat-requests', icon: <IoCreateOutline className="w-5 h-5" /> },
    { name: '신고 관리', href: '/admin/reports', icon: <IoWarningOutline className="w-5 h-5" /> },
    { name: '문의 관리', href: '/admin/contacts', icon: <IoMailOutline className="w-5 h-5" /> },
  ];

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
      <div className="p-4">
        <nav className="space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.name}
            </Link>
          ))}
          
          {isAdmin && (
            <>
              <div className="border-t border-gray-200 my-4"></div>
              {adminNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </>
          )}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;