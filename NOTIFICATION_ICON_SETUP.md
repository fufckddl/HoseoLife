# 알림 아이콘 설정 가이드

## 📱 플랫폼별 알림 아이콘 설정

### Android 알림 아이콘 ✅
- **파일**: `assets/images/hoseolife_notification_android.png`
- **사양**: 24×24px PNG (24dp 기준)
- **특징**: 
  - 투명 배경
  - 단색 실루엣
  - 알림 좌측에 표시됨
- **설정 위치**: 
  - `app.json` → `notification.icon`
  - `app.json` → `plugins` → `expo-notifications` → `icon`

### iOS 알림 아이콘 ⚠️
- **파일**: `assets/images/hoseolife_notification_ios.png`
- **사양**: 20×20px PNG (20pt 기준)
- **중요 제한사항**:
  - **iOS는 알림 좌측 아이콘을 런타임에 커스터마이징할 수 없음**
  - **알림 좌측에는 항상 앱 아이콘이 표시됨**
  - 제공된 20pt 아이콘은 시스템 설정/상태바에서만 사용됨
- **설정 위치**: 
  - `app.json` → `plugins` → `expo-notifications` → `iosIcon`

## 🔧 현재 설정 상태

### app.json 설정
```json
{
  "expo": {
    "notification": {
      "icon": "./assets/images/hoseolife_notification_android.png",
      "color": "#FFFFFF"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/hoseolife_notification_android.png",
          "iosIcon": "./assets/images/hoseolife_notification_ios.png",
          "color": "#ffffff",
          "defaultChannel": "default",
          "mode": "production"
        }
      ]
    ]
  }
}
```

### 아이콘 파일 검증 결과
- ✅ `hoseolife_notification_android.png`: 24×24px PNG
- ✅ `hoseolife_notification_ios.png`: 20×20px PNG

## 🚀 적용 방법

1. **새 빌드 생성**: 설정 변경사항이 반영되려면 새 빌드 필요
2. **Android**: 커스텀 아이콘이 알림에 표시됨
3. **iOS**: 앱 아이콘이 알림에 표시됨 (제공된 20pt는 시스템용)

## 📝 참고사항

- iOS에서 알림 좌측 아이콘을 변경하려면 앱 아이콘 자체를 변경해야 함
- Android는 알림 아이콘을 독립적으로 설정 가능
- Expo Go에서는 일부 제한이 있을 수 있음 (실제 빌드에서 테스트 권장)
