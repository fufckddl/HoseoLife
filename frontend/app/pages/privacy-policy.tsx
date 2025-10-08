import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>개인정보 처리방침</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>HoseoLife 개인정보 처리방침</Text>
        <Text style={styles.updateDate}>최종 수정일: 2025년 10월 7일</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 개인정보의 처리 목적</Text>
          <Text style={styles.sectionContent}>
            HoseoLife(이하 "서비스 제공자")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.{'\n\n'}
            
            가. 회원 가입 및 관리{'\n'}
            {'\u00A0\u00A0'}• 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증{'\n'}
            {'\u00A0\u00A0'}• 회원자격 유지·관리, 서비스 부정이용 방지{'\n\n'}
            
            나. 재화 또는 서비스 제공{'\n'}
            {'\u00A0\u00A0'}• 콘텐츠 제공, 맞춤 서비스 제공{'\n'}
            {'\u00A0\u00A0'}• 본인인증, 연령인증{'\n\n'}
            
            다. 마케팅 및 광고에의 활용{'\n'}
            {'\u00A0\u00A0'}• 신규 서비스(제품) 개발 및 맞춤 서비스 제공{'\n'}
            {'\u00A0\u00A0'}• 이벤트 및 광고성 정보 제공 및 참여기회 제공
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 개인정보의 처리 및 보유 기간</Text>
          <Text style={styles.sectionContent}>
            ① 서비스 제공자는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.{'\n\n'}
            
            ② 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다:{'\n\n'}
            
            가. 회원 가입 및 관리: 회원 탈퇴 시까지{'\n'}
            {'\u00A0\u00A0'}다만, 다음의 사유에 해당하는 경우에는 해당 사유 종료 시까지{'\n'}
            {'\u00A0\u00A0'}• 관계 법령 위반에 따른 수사·조사 등이 진행중인 경우: 해당 수사·조사 종료 시까지{'\n'}
            {'\u00A0\u00A0'}• 서비스 이용에 따른 채권·채무관계 잔존 시: 해당 채권·채무관계 정산 시까지{'\n\n'}
            
            나. 재화 또는 서비스 제공: 재화·서비스 공급완료 시까지{'\n\n'}
            
            다. 회원 탈퇴 후 게시물 처리{'\n'}
            {'\u00A0\u00A0'}• 회원이 작성한 게시글 및 댓글은 "(알 수 없음)"으로 익명 처리되어 유지됩니다{'\n'}
            {'\u00A0\u00A0'}• 회원 정보는 즉시 삭제되며 복구할 수 없습니다
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 처리하는 개인정보의 항목</Text>
          <Text style={styles.sectionContent}>
            서비스 제공자는 다음의 개인정보 항목을 처리하고 있습니다:{'\n\n'}
            
            가. 필수항목{'\n'}
            {'\u00A0\u00A0'}• 이메일 주소{'\n'}
            {'\u00A0\u00A0'}• 비밀번호 (암호화 저장){'\n'}
            {'\u00A0\u00A0'}• 닉네임{'\n\n'}
            
            나. 선택항목{'\n'}
            {'\u00A0\u00A0'}• 프로필 이미지{'\n'}
            {'\u00A0\u00A0'}• 위치 정보 (게시글 작성 시){'\n\n'}
            
            다. 자동 수집 항목{'\n'}
            {'\u00A0\u00A0'}• 서비스 이용 기록{'\n'}
            {'\u00A0\u00A0'}• 접속 로그{'\n'}
            {'\u00A0\u00A0'}• 기기 정보{'\n'}
            {'\u00A0\u00A0'}• IP 주소
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. 개인정보의 파기</Text>
          <Text style={styles.sectionContent}>
            ① 서비스 제공자는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.{'\n\n'}
            
            ② 개인정보 파기의 절차 및 방법은 다음과 같습니다:{'\n\n'}
            
            가. 파기절차{'\n'}
            {'\u00A0\u00A0'}• 서비스 제공자는 파기 사유가 발생한 개인정보를 선정하고, 서비스 제공자의 개인정보 보호책임자의 승인을 받아 개인정보를 파기합니다.{'\n\n'}
            
            나. 파기방법{'\n'}
            {'\u00A0\u00A0'}• 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다.{'\n'}
            {'\u00A0\u00A0'}• 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각을 통하여 파기합니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. 정보주체의 권리·의무 및 그 행사방법</Text>
          <Text style={styles.sectionContent}>
            ① 정보주체는 서비스 제공자에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:{'\n\n'}
            
            {'\u00A0\u00A0'}1. 개인정보 열람요구{'\n'}
            {'\u00A0\u00A0'}2. 오류 등이 있을 경우 정정 요구{'\n'}
            {'\u00A0\u00A0'}3. 삭제요구{'\n'}
            {'\u00A0\u00A0'}4. 처리정지 요구{'\n\n'}
            
            ② 제1항에 따른 권리 행사는 서비스 제공자에 대해 서면, 전화, 전자우편 등을 통하여 하실 수 있으며 서비스 제공자는 이에 대해 지체 없이 조치하겠습니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. 개인정보의 안전성 확보 조치</Text>
          <Text style={styles.sectionContent}>
            서비스 제공자는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:{'\n\n'}
            
            {'\u00A0\u00A0'}1. 관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육 등{'\n'}
            {'\u00A0\u00A0'}2. 기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치{'\n'}
            {'\u00A0\u00A0'}3. 물리적 조치: 전산실, 자료보관실 등의 접근통제
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. 개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항</Text>
          <Text style={styles.sectionContent}>
            서비스 제공자는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '토큰(Token)'을 사용합니다.{'\n\n'}
            
            토큰은 웹사이트를 운영하는데 이용되는 서버가 이용자의 기기 브라우저에게 보내는 소량의 정보이며 이용자의 기기 디스크에 저장되기도 합니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. 개인정보 보호책임자</Text>
          <Text style={styles.sectionContent}>
            ① 회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.{'\n\n'}
            
            ▶ 개인정보 보호책임자{'\n'}
            {'\u00A0\u00A0'}• 성명: HoseoLife 운영팀{'\n'}
            {'\u00A0\u00A0'}• 연락처: support@hoseolife.kr{'\n\n'}
            
            ② 정보주체께서는 회사의 서비스를 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. 개인정보 처리방침 변경</Text>
          <Text style={styles.sectionContent}>
            ① 이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. 위치정보의 수집 및 이용</Text>
          <Text style={styles.sectionContent}>
            ① 서비스 제공자는 사용자의 위치정보를 다음의 목적으로 수집 및 이용합니다:{'\n'}
            {'\u00A0\u00A0'}• 주변 게시글 표시{'\n'}
            {'\u00A0\u00A0'}• 위치 기반 콘텐츠 제공{'\n\n'}
            
            ② 위치정보는 사용자가 게시글을 작성할 때만 수집되며, 백그라운드에서는 수집되지 않습니다.{'\n\n'}
            
            ③ 사용자는 언제든지 앱 설정에서 위치 권한을 철회할 수 있습니다.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            본 방침은 2025년 10월 7일부터 시행됩니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  updateDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
  footer: {
    marginTop: 32,
    marginBottom: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

