# Voice Translator — 실시간 일↔영 음성 자막 (Android)

안드로이드 폰에서 **마이크로 들은 말을 실시간으로 인식해 반대 언어로 번역**하여 큰 자막으로 보여주는 앱입니다. 일본어 ↔ 영어 양방향.

핵심: **번역 모델만 처음 한 번 받으면 그 뒤로는 인터넷 없이(오프라인) 동작**합니다.

## 어떻게 동작하나

```
마이크 → 연속 음성 인식(SpeechRecognizer, 오프라인 우선)
       → 부분 결과로 원문 실시간 표시
       → 언어 자동 식별(ML Kit Language ID)
       → 온디바이스 번역(ML Kit Translate, 일↔영)
       → 화면에 큰 번역 자막
```

- **음성 인식**: 안드로이드 내장 `SpeechRecognizer`. 발화가 끝나면 자동 재시작해 *끊김 없이 연속* 청취.
- **번역 방향 자동**: 말한 문장이 일본어면 영어로, 그 외(영어)면 일본어로. 화면에 `JA → EN` / `EN → JA` 표시.
- **듣기 언어 토글**: 우상단 `🎙 日本語 / English` 버튼으로 인식 정확도를 위한 STT 언어를 전환(번역 방향은 그래도 자동).

## 주요 기능
- **온디바이스(오프라인) 인식** — 기본. 기기 내장 음성 인식기 + ML Kit 번역.
- **클라우드 Whisper(고정밀) 인식** — 설정에서 켬. Base URL·API Key·모델 입력 → 발화 단위로 Whisper-호환 API 전송. (`⚙ 설정`)
- **TTS 음성 출력** — 번역문을 소리로 읽어줌(목표 언어로). 설정 토글.
- **오버레이 자막** — 다른 앱 위에 떠 있는 드래그 가능한 실시간 자막(포그라운드 서비스). `⧉ 오버레이`
- **번역 방향 자동** — 일본어면 EN, 그 외면 JA.

## 아키텍처
```
SpeechEngine (인터페이스)
 ├─ OnDeviceSpeechEngine   안드로이드 SpeechRecognizer(오프라인 우선, 연속 재시작)
 └─ WhisperSpeechEngine    AudioRecord + 에너지 VAD → WAV → Whisper API(멀티파트)
TranslatorManager          ML Kit 언어식별 + 일↔영 온디바이스 번역
Speaker                    TextToSpeech 음성 출력
MainActivity / CaptionOverlayService  같은 엔진·번역기 공유(화면 / 오버레이)
AppSettings                SharedPreferences (엔진 선택·키·TTS·듣기 언어)
```

## 기술 스택

| 역할 | 사용 기술 | 오프라인 |
|---|---|---|
| 음성 인식(온디바이스) | Android `SpeechRecognizer` (`EXTRA_PREFER_OFFLINE`) | 언어팩 설치 시 ✅ |
| 음성 인식(클라우드) | Whisper-호환 API (`/v1/audio/transcriptions`) | ❌ (네트워크·키 필요) |
| 언어 식별 | `com.google.mlkit:language-id` | ✅ |
| 번역 | `com.google.mlkit:translate` (JA↔EN) | 모델 1회 다운로드 후 ✅ |
| 음성 출력 | Android `TextToSpeech` | 음성 데이터 설치 시 ✅ |
| 오버레이 | `TYPE_APPLICATION_OVERLAY` + 포그라운드 서비스(microphone) | — |
| UI | View + ViewBinding, Material3 (다크 자막 테마) | — |

- minSdk 24 / targetSdk 34 / Kotlin 1.9 / AGP 8.5
- 실기기 테스트 절차: [`docs/DEVICE_TESTING_ko.md`](docs/DEVICE_TESTING_ko.md)

## 빌드 방법

### 방법 A — Android Studio (권장)
1. Android Studio 에서 `projects/android-voice-translator` 폴더를 **Open**.
2. Gradle 동기화가 끝나면(Gradle 래퍼 jar 가 자동 생성됨) 실기기를 USB 로 연결.
3. **Run ▶** → 폰에 설치.

> 이 저장소에는 바이너리(`gradle-wrapper.jar`)를 커밋하지 않았습니다. Android Studio 가 첫 동기화 때 만들어 줍니다. 커맨드라인을 쓰려면 한 번만 `gradle wrapper` 를 실행해 래퍼를 생성하세요.

### 방법 B — 커맨드라인
```bash
cd projects/android-voice-translator
gradle wrapper            # 최초 1회: gradlew + wrapper jar 생성
./gradlew assembleDebug   # APK 빌드 → app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug    # 연결된 기기에 바로 설치
```

## 처음 실행할 때
1. 앱 실행 → 마이크 권한 허용.
2. 첫 실행 시 일↔영 번역 모델을 내려받습니다(상태표시줄 "번역 모델 준비 중…"). Wi-Fi 권장.
3. 인식이 잘 되려면 폰 설정에서 **Google 음성 인식 / 오프라인 언어팩**(일본어·영어)이 설치돼 있어야 합니다.
   - 설정 → 시스템 → 언어 및 입력 → 음성 → 오프라인 음성 인식 → 일본어/영어 다운로드.
4. `● 듣기 시작` → 말하면 위에 원문, 아래에 큰 번역 자막이 뜹니다.

## 한계 / 다음 단계
- 온디바이스 STT는 기기 내장 품질에 의존합니다. 더 높은 정확도가 필요하면 **설정에서 클라우드 Whisper** 로 전환(네트워크·API 키 필요).
- 두 사람이 번갈아 말하는 *완전 자동 양방향*은 STT 언어 힌트 한계로 토글을 함께 두었습니다. 화자 분리가 필요하면 클라우드 경로 권장.
- 클라우드 Whisper는 발화 단위 전송이라 약간의 지연이 있습니다(정확도↔지연 트레이드오프). 실시간 스트리밍 STT로 더 줄일 수 있습니다.
- 후보: 번역 이력 저장/내보내기, 부분(실시간) 클라우드 전사, 자막 글꼴 크기 사용자 조절.
