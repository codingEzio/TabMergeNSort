# Tab Merge N Sort

<p><img src="extension_chrome/icons/icon-128.png" width="96" height="96" alt="Tab Merge N Sort"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

## 개요

탭을 합치고 현재 창 또는 모든 창의 탭을 URL이나 제목 순으로 정렬합니다. Chrome 소스 버전은0.99.1이며 보존된 데스크톱 Safari는0.99.0입니다.

## 사용

Chrome의 “압축해제된 확장 프로그램 로드”에서 extension_chrome/을 선택하고 병합／정렬 기능을 사용합니다. 업데이트 시 공개 키로 고정된 확장 ID와 storage keys를 유지하세요. 작업 공간 hub나 심볼릭 링크가 필요하지 않습니다.

## 플랫폼 제한

데스크톱 Safari는 필수 tabs.move를 지원하지 않습니다. API가 없으면 탭을 이동할 수 없다고 알리고 원래 탭을 유지합니다. 탭을 닫고 다시 여는 우회나 네이티브 자동화 권한을 추가하지 않습니다. 버전 번호는 Chrome과의 기능 동등성을 뜻하지 않습니다. 네이티브 빌드는 macOS, Xcode, XcodeGen과 개인 서명 설정이 별도로 필요합니다. iOS／VIA 및 Firefox 배포는 포함하지 않습니다.

## 소스와 빌드

Deno2.x와 Git을 설치하고 저장소에서 아래 명령을 실행합니다. 검사는 합성 로컬 예제를 사용합니다. 빌드는 무시된 Local/candidates에 후보를 만들고 정확한 바이트를 읽어 확인합니다. 확장을 설치하거나 브라우저를 열거나 개인 설정을 읽지 않습니다. 일반 검사는 고정된 로컬 의존성을 사용하며 형제 소스 디렉터리가 필요하지 않습니다.

```sh
deno task check
deno task build
```

## 개인정보와 소스 검토

검토한 파일을 이름으로 지정하여 스테이징한 뒤 deno task public:check와 deno task public:prepare를 실행합니다. public-source.json은 정확한 Git index 입력을 선택하고 개인 운영 기록, 설정 및 Git 기록은 제외합니다. 후보는 변경할 수 없으며 재실행은 일치 여부만 확인하고 불일치를 덮어쓰지 않습니다. 제한된 패턴 검사는 전체 기록이나 모든 비밀의 검증이 아닙니다. 준비 과정은 수신 대상, 데이터 또는 브라우저 설정을 바꾸지 않습니다.

## 라이선스

이번 버전 자체 코드는 GNU GPL 제3판만 적용하는 GPL-3.0-only입니다. 이전 버전의 MIT 허가는 유지됩니다. 글꼴과 제삼자 자산의 원래 약관도 유지합니다. LICENSE, 과거 MIT 허가 및 모든 notices를 보존하세요. 전체 자산 권리와 내용 검토는 공개 전에 필요합니다. 로컬 후보는 공개, 설치 또는 전체 기록 정리를 의미하지 않습니다.
