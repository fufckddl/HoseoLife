import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>이용약관</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>HoseoLife 서비스 이용약관</Text>
        <Text style={styles.updateDate}>최종 수정일: 2025년 10월 7일</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제1조 (목적)</Text>
          <Text style={styles.sectionContent}>
            본 약관은 HoseoLife(이하 "서비스 제공자")가 제공하는 모바일 애플리케이션 서비스(이하 "서비스")의 이용과 관련하여 서비스 제공자와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제2조 (정의)</Text>
          <Text style={styles.sectionContent}>
            1. "서비스"란 HoseoLife가 제공하는 모든 서비스를 의미합니다.{'\n'}
            2. "이용자"란 본 약관에 따라 서비스 제공자가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.{'\n'}
            3. "회원"이란 서비스 제공자와 서비스 이용계약을 체결하고 이용자 아이디(ID)를 부여받은 자를 말합니다.{'\n'}
            4. "게시물"이란 회원이 서비스를 이용함에 있어 서비스에 게시한 문자, 문서, 그림, 음성, 링크, 파일 또는 이들의 조합으로 이루어진 정보를 말합니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제3조 (약관의 효력 및 변경)</Text>
          <Text style={styles.sectionContent}>
            1. 본 약관은 서비스를 이용하고자 하는 모든 이용자에게 그 효력이 발생합니다.{'\n'}
            2. 서비스 제공자는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 공지됩니다.{'\n'}
            3. 변경된 약관에 동의하지 않는 이용자는 서비스 이용을 중단하고 탈퇴할 수 있습니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제4조 (회원가입)</Text>
          <Text style={styles.sectionContent}>
            1. 회원가입은 이용자가 약관의 내용에 대하여 동의를 하고 회원가입신청을 한 후 서비스 제공자가 이러한 신청에 대하여 승낙함으로써 체결됩니다.{'\n'}
            2. 서비스 제공자는 다음 각 호에 해당하는 신청에 대하여는 승낙을 거절하거나 사후에 이용계약을 해지할 수 있습니다:{'\n'}
            {'\u00A0\u00A0'}• 타인의 명의를 도용한 경우{'\n'}
            {'\u00A0\u00A0'}• 허위의 정보를 기재한 경우{'\n'}
            {'\u00A0\u00A0'}• 만 14세 미만인 경우{'\n'}
            {'\u00A0\u00A0'}• 기타 서비스 제공자가 정한 이용신청 요건이 미비한 경우
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제5조 (회원 탈퇴 및 자격 상실)</Text>
          <Text style={styles.sectionContent}>
            1. 회원은 언제든지 서비스 이용을 원하지 않는 경우 회원 탈퇴를 할 수 있습니다.{'\n'}
            2. 회원이 다음 각 호의 사유에 해당하는 경우, 서비스 제공자는 회원자격을 제한 및 정지시킬 수 있습니다:{'\n'}
            {'\u00A0\u00A0'}• 타인의 명의를 사용한 경우{'\n'}
            {'\u00A0\u00A0'}• 서비스 운영을 고의로 방해한 경우{'\n'}
            {'\u00A0\u00A0'}• 공공질서 및 미풍양속에 저해되는 내용을 고의로 유포한 경우{'\n'}
            {'\u00A0\u00A0'}• 타인의 명예를 손상시키거나 불이익을 주는 행위를 한 경우{'\n'}
            {'\u00A0\u00A0'}• 범죄적 행위에 관련되는 경우
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제6조 (개인정보보호)</Text>
          <Text style={styles.sectionContent}>
            1. 서비스 제공자는 관련법령이 정하는 바에 따라 회원 등록정보를 포함한 회원의 개인정보를 보호하기 위해 노력합니다.{'\n'}
            2. 회원의 개인정보 보호 및 사용에 대해서는 관련법령 및 서비스 제공자의 개인정보처리방침이 적용됩니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제7조 (회원의 의무)</Text>
          <Text style={styles.sectionContent}>
            1. 회원은 다음 행위를 하여서는 안됩니다:{'\n'}
            {'\u00A0\u00A0'}• 신청 또는 변경 시 허위내용의 등록{'\n'}
            {'\u00A0\u00A0'}• 타인의 정보도용{'\n'}
            {'\u00A0\u00A0'}• 서비스 제공자가 게시한 정보의 변경{'\n'}
            {'\u00A0\u00A0'}• 서비스 제공자가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시{'\n'}
            {'\u00A0\u00A0'}• 서비스 제공자 기타 제3자의 저작권 등 지적재산권에 대한 침해{'\n'}
            {'\u00A0\u00A0'}• 서비스 제공자 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위{'\n'}
            {'\u00A0\u00A0'}• 외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제8조 (게시물의 관리)</Text>
          <Text style={styles.sectionContent}>
            1. 회원의 게시물이 정보통신망법 및 저작권법 등 관련법에 위반되는 내용을 포함하는 경우, 권리자는 관련법이 정한 절차에 따라 해당 게시물의 게시중단 및 삭제 등을 요청할 수 있으며, 서비스 제공자는 관련법에 따라 조치를 취하여야 합니다.{'\n'}
            2. 서비스 제공자는 전항에 따른 권리자의 요청이 없는 경우라도 권리침해가 인정될 만한 사유가 있거나 기타 서비스 정책 및 관련법에 위반되는 경우에는 관련법에 따라 해당 게시물에 대해 임시조치 등을 취할 수 있습니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제9조 (부적절한 콘텐츠 및 행위에 대한 제재)</Text>
          <Text style={styles.sectionContent}>
            1. 서비스 제공자는 다음 각 호에 해당하는 부적절한 콘텐츠 또는 행위에 대해 무관용 원칙을 적용합니다:{'\n'}
            {'\u00A0\u00A0'}• 스팸성 콘텐츠{'\n'}
            {'\u00A0\u00A0'}• 괴롭힘, 협박, 욕설 등 타인을 불쾌하게 하는 행위{'\n'}
            {'\u00A0\u00A0'}• 성적으로 노골적이거나 선정적인 콘텐츠{'\n'}
            {'\u00A0\u00A0'}• 불법적인 내용 또는 활동{'\n'}
            {'\u00A0\u00A0'}• 개인정보 무단 노출{'\n'}
            {'\u00A0\u00A0'}• 저작권 침해{'\n'}
            {'\u00A0\u00A0'}• 허위 정보 유포{'\n\n'}
            2. 서비스 제공자는 부적절한 콘텐츠가 신고되거나 발견된 경우, 다음과 같은 조치를 취합니다:{'\n'}
            {'\u00A0\u00A0'}• 해당 콘텐츠의 즉시 삭제{'\n'}
            {'\u00A0\u00A0'}• 위반자에 대한 경고{'\n'}
            {'\u00A0\u00A0'}• 반복적인 위반 시 계정 일시 정지 (1일~90일){'\n'}
            {'\u00A0\u00A0'}• 심각한 위반 시 계정 영구 정지{'\n\n'}
            3. 서비스 제공자는 신고된 부적절한 콘텐츠를 24시간 이내에 검토하고 처리합니다.{'\n\n'}
            4. 제재 조치를 받은 회원은 이의를 제기할 수 있으며, 서비스 제공자는 합리적인 기간 내에 재검토합니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제10조 (신고 제도)</Text>
          <Text style={styles.sectionContent}>
            1. 회원은 부적절한 게시물, 댓글, 또는 다른 회원의 부적절한 행위를 발견한 경우 이를 신고할 수 있습니다.{'\n'}
            2. 신고는 각 게시물 또는 댓글의 메뉴에서 "신고하기" 기능을 통해 할 수 있습니다.{'\n'}
            3. 서비스 제공자는 접수된 모든 신고를 검토하며, 정당한 신고에 대해서는 적절한 조치를 취합니다.{'\n'}
            4. 허위 신고를 반복하는 회원에 대해서는 제재 조치를 취할 수 있습니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제11조 (저작권의 귀속 및 이용제한)</Text>
          <Text style={styles.sectionContent}>
            1. 서비스 제공자가 작성한 저작물에 대한 저작권 기타 지적재산권은 서비스 제공자에게 귀속합니다.{'\n'}
            2. 회원은 서비스를 이용함으로써 얻은 정보 중 서비스 제공자에게 지적재산권이 귀속된 정보를 서비스 제공자의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안됩니다.{'\n'}
            3. 회원이 서비스 내에 게시한 게시물의 저작권은 해당 게시물의 저작자에게 귀속됩니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제12조 (손해배상)</Text>
          <Text style={styles.sectionContent}>
            서비스 제공자는 서비스의 이용과 관련하여 개인정보보호정책에서 정하는 내용에 해당하지 않는 사항에 대하여는 어떠한 손해도 책임을 지지 않습니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제13조 (면책조항)</Text>
          <Text style={styles.sectionContent}>
            1. 서비스 제공자는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.{'\n'}
            2. 서비스 제공자는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.{'\n'}
            3. 서비스 제공자는 회원이 서비스에 게재한 정보, 자료, 사실의 신뢰도, 정확성 등의 내용에 관하여는 책임을 지지 않습니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제14조 (분쟁해결)</Text>
          <Text style={styles.sectionContent}>
            1. 서비스 제공자는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 피해보상처리기구를 설치·운영합니다.{'\n'}
            2. 서비스 제공자는 이용자로부터 제출되는 불만사항 및 의견은 우선적으로 그 사항을 처리합니다. 다만, 신속한 처리가 곤란한 경우에는 이용자에게 그 사유와 처리일정을 즉시 통보합니다.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제15조 (재판권 및 준거법)</Text>
          <Text style={styles.sectionContent}>
            1. 이 약관에 명시되지 않은 사항은 전기통신사업법 등 관계법령과 상관습에 따릅니다.{'\n'}
            2. 서비스 이용으로 발생한 분쟁에 대해 소송이 필요한 경우 대한민국 법원의 관할에 따릅니다.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            본 약관은 2025년 10월 7일부터 시행됩니다.
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

