# CUA 권한 프록시: 기술 타당성 검토 (2026-10-26)

> 범위: 화면을 보고 클릭·타이핑하는 computer-use agent(CUA)와 실제 환경 사이에 서서, 앱별로 정책을 집행하고 관측을 가리고 변조 탐지가 가능한 원장을 남기는 프록시. 10일 안에 혼자 만들 수 있는지를 본다.
> 재사용: Muse Sentinel(tainted egress, 승인 게이트, 감사 로그)은 `leakage.md` §5와 `a2a-delegates.md` §1.2에 이미 정리돼 있어 여기서 반복하지 않는다. 선행 제품·논문 조사는 별도 노트(CuaPermissionPriorArt)가 맡는다. 이 문서는 **인터페이스, 매핑, 필터, 샌드박스, 원장**의 실현 가능성만 다룬다.

## 요약

- **액션 경계에 끼우는 것은 쉽다.** Anthropic, OpenAI, Gemini, Meta 네 API가 모두 "모델은 액션 JSON만 내고, 실행과 스크린샷은 클라이언트가 한다"는 구조다. 그래서 프록시를 그 "클라이언트 실행기(driver)"로 끼우면 모델 쪽 변경이 전혀 없다. `[배포]`
- **Meta Model API에도 네이티브 `computer` 도구가 있다.** Responses API 전용이고, 스키마는 OpenAI와 사실상 같다(`computer_call`, `actions[]`, `pending_safety_checks`). Meta 문서는 "environment, driver, screenshot capture, **and safety**는 당신 몫"이라고 적고 있다. 이 프로젝트가 바로 그 빈칸을 채운다. `[배포]`
- **픽셀을 의미로 바꾸는 매핑은 브라우저 안에서는 신뢰할 만하다.** CDP 히트테스트에 AX 트리를 붙이면 된다. 데스크톱은 앱마다 편차가 크고(Electron, canvas), 키보드 단축키와 TOCTOU가 실제 난제다. `[추론]`
- **SAM 3.1을 마스킹의 주력으로 쓰기는 어렵다.** 자연 이미지의 명사구 개념 분할에 강하고, UI 위젯 분할은 문서상 근거가 없다. 주력은 DOM/AX 박스 마스킹, 보조는 OCR+정규식, 이미지형 민감 영역(얼굴, 카드 사진, QR)에만 SAM 3.1을 쓴다. `[추론]`
- **권장 스택**: Docker 안에 Chromium, Xvfb, noVNC를 두고, 바깥의 프록시가 CDP 소켓을 단독으로 소유한다. 에이전트는 Muse Wonder/Spark `computer` 도구를 쓴다. 승인 UI와 해시체인 원장을 붙인다. 액션당 오버헤드는 fast path 기준 약 0.05~0.25초로 추정된다. 실측 관측-행동 간격(평균 6.51초)의 수 % 수준이다. `[추론]`

---

## 1. 에이전트 액션 인터페이스: 정확한 스키마

### 1.1 Anthropic: `computer_toolset_20260801` `[배포]`
- 출처: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- 선언: `tools: [{"type": "computer_toolset_20260801"}]`. beta 헤더가 필요 없다. `display_width_px` 같은 크기 필드는 거부된다. 좌표는 "돌려준 스크린샷의 픽셀 공간"이다. 선택 필드는 `configs.{member}.enabled`/`defer_loading`이다.
- 호출: `tool_use` 블록이 `name`=멤버명, `"toolset_name": "computer"`, `input`=멤버 파라미터를 담는다. `action` 필드는 없다. 한 턴에 여러 블록이 오는 **batch**이며 순서대로 실행해야 한다.
- 멤버 17개와 입력:
  - `screenshot {}`
  - `zoom {region:[x0,y0,x1,y1]}`: 영역 원해상도 이미지를 반환한다.
  - `left_click`, `right_click`, `middle_click`, `double_click`, `triple_click {coordinate?:[x,y], text?: "shift"|"ctrl"|"alt"|"super"|"ctrl+shift"…}`: **coordinate를 생략하면 현재 커서 위치를 클릭한다.**
  - `left_click_drag {start_coordinate, coordinate, text?}`
  - `mouse_move {coordinate}`, `left_mouse_down {}`, `left_mouse_up {}`, `cursor_position {}`
  - `scroll {scroll_direction: up|down|left|right, scroll_amount, coordinate?, text?}`
  - `type {text}`
  - `key {text: "Return"|"ctrl+s"|"alt+Tab", repeat?: 1..100}`
  - `hold_key {text, duration≤300}`
  - `wait {duration≤300}`
- 결과: `tool_result{tool_use_id, toolset_name:"computer", content:[text|image]}`. 실패 시에는 `is_error:true`를 보낸다. 같은 batch에서 실패 이후 액션에는 정확히 `"Not executed: an earlier computer action in this turn failed."`를 돌려줘야 한다.
- 문서 원문: "If your application asks a human to confirm consequential actions, make that check before each block runs, because a batch can complete a multistep action within one turn."
- 프록시 관점 `[추론]`:
  - 거부를 `is_error`와 사유 텍스트로 돌려줄 수 있다. 모델이 다시 계획하게 만드는 **가장 프록시 친화적인 API**다.
  - `zoom`은 관측 채널이므로 마스킹을 zoom 크롭에도 적용해야 한다.
  - 좌표 없는 클릭, `mouse_down`/`mouse_up`으로 쪼갠 드래그 때문에 커서와 버튼 상태 머신이 필요하다.
- 참고: 웹 전용인 `browser_toolset_20260801`(멤버 27개)은 `read_page`가 `button "Search" [ref_4]` 같은 ref를 주고 `{type:"ref",ref}` 또는 좌표로 클릭한다. ref 기반이라 의미 매핑이 공짜다. `[배포]` https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool

### 1.2 OpenAI: Responses API `computer` 도구 (구 computer-use-preview) `[배포]`
- 출처: https://developers.openai.com/api/docs/guides/tools-computer-use
- 선언: `tools=[{"type":"computer"}]` (예시 모델 `gpt-6.1-sol`). 문서는 GPT-6 Astra에는 **코드 실행(Playwright/pyautogui를 돌리는 `exec_js`/`exec_py` function tool)을 권장**하고, `computer` 도구는 대안으로 유지한다. 구 `computer-use-preview`에서 옮기는 마이그레이션 가이드가 있다.
- 호출: `{"type":"computer_call","call_id":"call_002","actions":[{"type":"click","button":"left","x":405,"y":157},{"type":"type","text":"penguin"}]}`
  - 액션 타입: `click`, `double_click`, `drag`, `move`, `scroll`, `keypress`, `type`, `wait`, `screenshot`
- 결과: `{"type":"computer_call_output","call_id":…,"output":{"type":"computer_screenshot","image_url":"data:image/png;base64,…"}}`. `previous_response_id`로 체이닝한다.
- **SDK `ComputerToolset(driver)` + `beforeAction` 훅**: 공식 예제가 바로 프록시 패턴이다. 예제는 다음 일을 한다.
  - `allowed(action)`에서 클릭 좌표가 특정 locator의 boundingBox 안인지 검사한다.
  - `click()`에서 "The page may have changed after approval, so bind the click again"이라며 **실행 직전에 재검증**한다.
  - 나머지 액션은 `refuse`로 막는다.
- 문서 원문: "Typing sensitive information into a form counts as transmission."
- 프록시 관점 `[추론]`: 코드 실행 모드(`exec_py`)를 쓰면 GUI 경계가 무의미해진다. 프록시는 **코드 실행 도구를 제공하지 않는 것**을 전제로 한다.

### 1.3 Google Gemini Computer Use `[프리뷰/베타]`
- 출처: https://ai.google.dev/gemini-api/docs/computer-use
- Gemini 3.5 Flash에서 public preview로 시작했다(changelog https://ai.google.dev/gemini-api/docs/changelog). 문서 예시는 `gemini-3.8-flash`이고, Interactions API를 쓴다.
- 선언: `tools=[{"type":"computer_use","environment":"browser"|"desktop"|"mobile","enable_prompt_injection_detection":true,"excluded_predefined_functions":[…],"disabled_safety_policies":[…]}]`
- 호출: `steps[].type:"function_call", name:"click", arguments:{x:450,y:120,intent:"…"}`
  - **좌표는 0–999로 정규화**돼 있어 클라이언트가 화면 크기로 되돌려야 한다.
  - 모든 액션에 `intent` 문자열이 붙는다.
  - `arguments.safety_decision{decision:"require_confirmation",explanation}`이 오면 사용자에게 확인을 받고, 결과에 `safety_acknowledgement`를 넣는다.
- 액션:
  - browser: `click`, `double_click`, `triple_click`, `middle_click`, `right_click`, `mouse_down`, `mouse_up`, `move {x,y}`, `type {text, press_enter?}`, `drag_and_drop {start_x,start_y,end_x,end_y}`, `wait {seconds}`, `press_key {key}`, `key_down`, `key_up`, `hotkey {keys[]}`, `take_screenshot`, `scroll {x,y,direction,magnitude_in_pixels}`, `go_back`, `navigate {url}`, `go_forward`
  - desktop: browser에서 navigate/back/forward를 뺀 것
  - mobile: `open_app {app_name}`, `list_apps`, `long_press` 등
- 결과: `{"type":"function_result","name","call_id","result":[{"type":"text","text":"{\"url\":…}"},{"type":"image",…}]}`
- 프록시 관점 `[추론]`:
  - `navigate {url}`, `open_app {app_name}`은 **의미가 명시된 액션**이라 정책을 적용하기 가장 쉽다.
  - `type.press_enter`, `key_down`/`key_up`으로 쪼갠 조합키는 상태 추적이 필요하다.
  - `intent`는 모델이 스스로 신고한 것이므로 **신뢰하지 않는 힌트**로만 원장에 남긴다. 실제 타깃과 불일치하면 경보를 낸다.

### 1.4 browser-use `[배포]`
- 소스: https://github.com/browser-use/browser-use (`browser_use/tools/views.py`, `tools/service.py`)
- 액션(레지스트리 함수명): `navigate`, `search`, `click`, `input`, `scroll`, `send_keys`, `select_dropdown`, `dropdown_options`, `upload_file`, `switch`, `close`, `go_back`, `wait`, `extract`, `search_page`, `find_elements`, `find_text`, `evaluate`, `screenshot`, `save_as_pdf`, `read_file`, `write_file`, `replace_file`, `done`
- 파라미터 모델:
  - `ClickElementAction{index?:int≥1, coordinate_x?, coordinate_y?}`
  - `InputTextAction{index, text, clear=True}`
  - `NavigateAction{url, new_tab=False}`
  - `SendKeysAction{keys:"Escape"|"Control+o"}`
  - `UploadFileAction{index, path}`
  - `SwitchTabAction{tab_id: 4자}`
  - `ScrollAction{down, pages, index?}`
- 관측: `browser_state`(인덱스가 붙은 DOM 요소 목록)와 스크린샷이다.
- 프록시 관점 `[추론]`:
  - 인덱스는 이미 DOM 요소에 바인딩돼 있어 의미 매핑이 쉽다. 다만 실행이 같은 파이썬 프로세스 안에서 CDP로 직접 일어나므로 **API 경계 프록시가 아니라 in-process 훅**이 된다.
  - 커스텀 `Tools` 레지스트리로 기본 액션을 감싸거나 빼는 방식이다(https://pydantic.dev/docs/ai/harness/browser-use 의 "register your own actions, exclude built-ins").
  - `evaluate`는 임의 JS 실행이라 반드시 막아야 한다.

### 1.5 Playwright MCP `[배포]`
- 출처: https://github.com/microsoft/playwright-mcp
- 기본은 접근성 스냅샷 기반이다("No vision models needed").
- 도구(발췌):
  - `browser_click {element?, target, doubleClick?, button?}`
  - `browser_type {element?, target, text, submit?, slowly?}`
  - `browser_press_key {key}`
  - `browser_navigate {url}`
  - `browser_select_option {element?, target, values[]}`
  - `browser_drag {startTarget, endTarget…}`
  - `browser_file_upload {paths[]}`
  - `browser_fill_form {fields[]}`
  - `browser_handle_dialog {accept, promptText?}`
  - `browser_tabs {action,index?,url?}`
  - `browser_snapshot {target?, depth?}`
  - `browser_take_screenshot`
  - `browser_evaluate {function}`
  - `browser_run_code {code}`: README가 "RCE-equivalent"라고 명시한다.
  - 좌표 기반 도구는 `--caps=vision`으로 켠다: `browser_mouse_click_xy {x,y,button?,clickCount?}`, `browser_mouse_drag_xy`, `browser_mouse_wheel {deltaX,deltaY}` 등.
- 주목할 점:
  - `element` 파라미터가 **"Human-readable element description used to obtain permission to interact with the element"**로 정의돼 있다. 권한 확인용 훅을 의도한 설계다. 다만 모델이 써 넣는 값이므로 프록시는 `target` ref를 실제 AX 노드로 다시 해석해야 한다. `[추론]`
  - `--allowed-origins`/`--blocked-origins`에는 "does not serve as a security boundary and does not affect redirects"라는 경고가 붙어 있다.
- 프록시 관점 `[추론]`: MCP `tools/call`을 가로채는 MCP 프록시로 구현할 수 있다. `browser_evaluate`와 `browser_run_code`는 거부한다.

### 1.6 Meta Model API (dev.meta.ai)
- **네이티브 computer 도구** `[배포]`(Muse Wonder 자체는 `[프리뷰/베타]`): https://dev.meta.ai/docs/computer-use
  - 선언: `{"tools":[{"type":"computer"}]}`. Responses API가 "its only supported endpoint"이고, display 크기 필드는 없다.
  - 호출: `{"type":"computer_call","id","call_id","actions":[{"type":"click","button":"left","x":412,"y":315},{"type":"type","text":"…"},{"type":"keypress","keys":["Enter"]}],"pending_safety_checks":[],"status":"completed"}`
  - 액션 표: `click{button: left|right|wheel|back|forward, x, y}`, `double_click{x,y}`, `drag{path:[{x,y}]}`, `keypress{keys[]}`, `move{x,y}`, `scroll{x,y,scroll_x,scroll_y}`, `type{text}`, `screenshot`, `wait`
  - 결과: `computer_call_output{call_id, acknowledged_safety_checks, output:{type:"computer_screenshot", image_url: data URL ≤25MiB}}`
  - `pending_safety_checks`는 `{id, code, message}` 형태다(예: `malicious_instructions`).
  - stateless replay는 29쌍까지, `truncation:"auto"`는 계정마다 다르다.
  - 문서 원문: "There's no server-side virtual machine… You supply the rest: the environment, the driver…, screenshot capture, **and safety**." 그리고 "Stop the batch early if an action fails, the page navigates unexpectedly, or a modal changes the screen…"
  - 모델: 예시는 `muse-wonder-1.0`, 비용을 줄이려면 `muse-spark-1.3`도 같은 루프로 돌 수 있다고 명시한다.
- **쿡북** `[배포]`: https://dev.meta.ai/docs/cookbook/computer-use. Muse Spark와 OpenCode에 **trycua/cua** 로컬 Docker 데스크톱과 MCP 브리지(`cua_local_mcp.py`: screenshot, left_click, right_click, type_text, press_key, **run_command**)를 붙인 예다. 요청당 이미지 50장 한도 때문에 서브에이전트로 쪼갰다. macOS 네이티브 이벤트 레시피(`cookbook/computer-use-macos`)도 있다.
- **이미지 입력** `[배포]`: https://dev.meta.ai/docs/image-understanding. `input_image`를 쓰고 **요청당 최대 50장**이다. "perception grounding"으로 0–1000 정규화 좌표의 point, box, count를 JSON으로 받을 수 있다. VLM 폴백(§2.3)에 바로 쓸 수 있다.
- **함수 호출** `[배포]`: https://dev.meta.ai/docs/tool-calling. `function`(JSON Schema)과 `custom`(자유 텍스트) 도구, 병렬 tool call을 지원한다. Responses, Chat Completions, Messages 세 프로토콜이 다 된다(https://dev.meta.ai/docs/models).
- **Muse Glimmer**: text+image 입력, 셀프호스트 전용(vLLM, llama.cpp 등)이다. 로컬 분류기로 쓸 수 있다. `[배포]` https://dev.meta.ai/docs/models
- 프록시 관점 `[추론]`:
  - Meta와 OpenAI의 `computer_call_output`에는 액션별 오류 채널이 없다. 거부 사실은 (a) 스크린샷에 "BLOCKED by policy: Send" 배너를 합성하거나 (b) 다음 입력에 `input_text`를 덧붙여 알린다.
  - `pending_safety_checks` 승인은 프록시의 사람 승인 UI로 연결한다. 자동으로 채우지 않는다. Meta 문서도 "not a field to auto-fill"이라고 적고 있다.
  - 쿡북 브리지의 `run_command`(셸)는 GUI 정책을 통째로 우회하는 구멍이다. 데모에서는 반드시 제거한다.

### 1.7 결론: drop-in 'computer' 백엔드가 되는가
| 인터페이스 | 실행 주체 | 프록시 삽입 지점 | 의미 정보 | 난이도 |
|---|---|---|---|---|
| Anthropic toolset | 클라이언트 | tool_use 실행기 | 좌표만 있음, 거부는 `is_error` | 낮음 |
| OpenAI `computer` | 클라이언트 | `ComputerToolset` driver + `beforeAction` | 좌표만 | 낮음 |
| Meta `computer` | 클라이언트 | Responses 루프 driver | 좌표만, safety checks 있음 | 낮음 |
| Gemini CU | 클라이언트 | function_result 실행기 | 좌표(0–999), `intent`, `navigate`/`open_app` | 낮음~중간 |
| browser-use | 라이브러리 내부 | Tools 레지스트리 래핑 | DOM index | 중간 |
| Playwright MCP | MCP 서버 | MCP 프록시 | AX ref, `element` 설명 | 낮음 |

- **결론**: 네 벤더 API 모두 **클라이언트가 실행**하는 구조라 프록시가 drop-in driver가 될 수 있다. 내부를 하나의 정규화 액션 IR(예: `{kind, point|path|keys|text|url, modifiers}`)로 두고, 벤더별 어댑터 4개(좌표 스케일과 Gemini 0–999 변환 포함)를 붙이는 구성이 현실적이다. `[추론]`
- 단 "모든 행동이 프록시를 지난다"는 보장은 API가 아니라 **샌드박스**(§4)가 만든다. 모델에게 셸, 코드 실행, CDP를 주면 경계가 무너진다. `[추론]`

---

## 2. 픽셀 클릭을 의미 요소로 매핑하기

### 2.1 앱 식별
- **macOS** `[배포]`:
  - `NSWorkspace.frontmostApplication`은 "the app that receives key events"를 돌려준다(https://developer.apple.com/documentation/appkit/nsworkspace/frontmostapplication). 여기서 `.bundleIdentifier`를 읽는다(https://developer.apple.com/documentation/appkit/nsrunningapplication/bundleidentifier).
  - 클릭 좌표 아래 창의 소유자는 `CGWindowListCopyWindowInfo`의 `kCGWindowOwnerPID`(필수 키)로 찾는다. 2차 출처: https://procxray.com/blog/how-to-find-which-process-owns-a-window-macos/
- **Linux/X11** `[배포]`: EWMH `_NET_ACTIVE_WINDOW`는 루트 속성으로 WM이 설정한다. `_NET_WM_PID`는 클라이언트가 직접 설정하므로 **위조할 수 있다**. https://specifications.freedesktop.org/wm/latest-single/ · https://specifications.freedesktop.org/wm-spec/wm-spec-1.3.html
- **브라우저**: URL과 origin은 CDP로 확정할 수 있다. `DOM.getNodeForLocation`이 `frameId`를 함께 돌려준다(§2.2). 탭과 탐색 이벤트는 CDP Target/Page로 받는다. `[배포]`
- 판단 `[추론]`:
  - "어느 앱인가"는 브라우저에서는 origin 단위로 **결정적**이다.
  - 데스크톱에서는 frontmost 판정이 클릭 시점의 창 z-order와 어긋날 수 있다(포커스 탈취, §2.4). 클릭 좌표 기준의 창 소유자를 함께 확인해야 한다.

### 2.2 히트테스트 API
| 플랫폼 | API | 반환 | 주의 |
|---|---|---|---|
| macOS | `AXUIElementCopyElementAtPosition(app_or_systemwide, x, y, &elem)` `[배포]` https://developer.apple.com/documentation/applicationservices/1462077-axuielementcopyelementatposition | AXUIElement(role, title, subrole) | "top-left relative screen coordinates", Retina 2x 스케일(Anthropic 문서 "macOS Retina displays… device pixel ratio of 2"), Accessibility 권한 필요 `[추론]` |
| Windows | `IUIAutomation::ElementFromPoint(POINT)` / `ElementFromPointBuildCache` `[배포]` https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomation-elementfrompoint | IUIAutomationElement | **물리 좌표**를 쓰므로 DPI 스케일링 주의(https://github.com/MicrosoftDocs/win32/blob/docs/desktop-src/WinAuto/uiauto-screenscaling.md). 반환 직후 요소가 사라지면 `UIA_E_ELEMENTNOTAVAILABLE`(https://learn.microsoft.com/en-us/previous-versions/dd319422(v=vs.85)) |
| Linux | AT-SPI `org.a11y.atspi.Component.GetAccessibleAtPoint(x, y, coord_type)` / `atspi_component_get_accessible_at_point` `[배포]` https://gnome.pages.gitlab.gnome.org/at-spi2-core/devel-docs/doc-org.a11y.atspi.Component.html · https://gnome.pages.gitlab.gnome.org/at-spi2-core/libatspi/method.Component.get_accessible_at_point.html | Accessible(role, name) | 툴킷마다 품질이 다르다. Chromium은 `--force-renderer-accessibility`가 있어야 트리가 확실히 나온다(https://chromium.googlesource.com/chromium/src/+/refs/tags/112.0.5590.0/tools/accessibility/inspect/README.md) |
| Chrome | CDP `DOM.getNodeForLocation{x, y, includeUserAgentShadowDOM?, ignorePointerEventsNone?}` → `{backendNodeId, frameId, nodeId?}` `[배포]` https://chromedevtools.github.io/devtools-protocol/tot/DOM/#method-getNodeForLocation | DOM 노드, 이어서 `Accessibility.getPartialAXTree{backendNodeId}`로 role과 name을 얻는다(https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/) | `ignorePointerEventsNone` 기본값이 false다. 투명 오버레이(pointer-events:none) 처리를 실제 클릭과 맞춰야 한다. cross-site iframe은 §2.4 참고 |

- 정책 매칭 키: `(app_id|origin, frame_origin, ax_role, accessible_name, 조상 체인의 landmark/form)`. 예: `origin=mail.example, role=button, name~/^Send$/ → DENY`. `[추론]`
- 전자 앱의 함정: Electron은 보조기술이 감지되지 않으면 AX 트리를 끈다. macOS에서 `AXManualAccessibility`를 켜야 하는데, 버전에 따라 이 속성이 실패한 사례가 있다. `[배포]` https://www.electronjs.org/docs/latest/tutorial/accessibility · https://github.com/electron/electron/issues/37465

### 2.3 VLM 폴백: 잘라낸 영역 분류
- 대상: AX가 비었거나 role/name이 무의미할 때(canvas, 게임, 커스텀 렌더러), 또는 고위험 정책에서 AX와 교차 확인할 때. `[추론]`
- 방법 `[추론]`:
  1. 클릭 좌표 주변을 잘라낸 크롭과 전체 축소본을 Muse Spark에 보낸다.
  2. 출력은 구조화 JSON `{label, is_destructive, matches_policy_rule_id, box}`로 받는다.
  3. Muse Spark perception grounding(0–1000 box)으로 "Send 버튼의 box"를 따로 받아 클릭 점이 그 안에 있는지 **기하학적으로 검증**한다(https://dev.meta.ai/docs/image-understanding).
- 비용과 지연: 매 액션마다 호출하면 루프가 두 배 가까이 느려진다. **AX로 해석 불가 + 정책상 민감 앱**일 때만 호출한다. 로컬 Muse Glimmer는 프라이버시 모드(스크린샷이 외부로 나가지 않음)용이다. `[추론]`
- 한계: VLM 분류 자체도 화면 속 프롬프트 인젝션의 대상이다. Anthropic과 Gemini도 스크린샷 인젝션 분류기를 따로 둔다(위 각 문서). 분류 결과는 **DENY 쪽으로만 신뢰**한다. VLM이 "안전"이라고 해도 정책상 deny-by-default는 유지한다. `[추론]`

### 2.4 함정과 완화책
| 함정 | 근거 | 완화(프록시 설계) |
|---|---|---|
| **TOCTOU**(스크린샷과 실행 사이에 UI가 바뀜) | OSWorld 실측 관측-행동 간격 **평균 6.51초**. 창 포커스 조작 공격은 액션 리다이렉션 **100%**에 관측 시점 흔적 0. 방어책 PUSV(클릭 지점 마스크 SSIM + 전역 diff + X 창 스냅샷 diff)가 180회 시도 100% 차단, 오탐 0, 오버헤드 0.1초 미만. 단 DOM 주입(시각 흔적 0)은 약 0% `[연구]` https://arxiv.org/abs/2604.18860 · 브라우저 에이전트 10종에서 TOCTOU가 광범위하다는 연구도 있다 `[연구]` https://arxiv.org/abs/2603.00476 (EMNLP 2026 Findings https://aclanthology.org/2026.findings-emnlp.680/) | **실행 직전에 히트테스트를 다시 하고 정책을 재평가한다.** 모델이 본 스크린샷의 클릭점 패치와 지금 화면 패치의 SSIM을 비교하고, 창과 노드의 정체성(backendNodeId, 창 id)이 같은지 확인한다. 어긋나면 실행하지 않고 새 스크린샷을 돌려준다. OpenAI 공식 예제의 "bind the click again"과 같은 패턴이다 `[배포]` |
| **키보드 단축키**(Cmd/Ctrl+Enter = 전송) | Gmail은 Ctrl/⌘+Enter로 전송하며, 단축키 설정과 무관하게 동작한다 `[배포]`(2차 출처 https://www.getinboxzero.com/blog/post/gmail-shortcuts-cheat-sheet) | 키 이벤트는 **포커스된 요소 기준으로 의미를 해석**한다. 포커스가 보호 대상 form(compose) 안에 있으면 Enter, Ctrl+Enter, Tab→Space를 "보호 컨트롤 활성화"로 간주한다. `type` 텍스트 안의 `\n`, Gemini `press_enter`도 같게 처리한다. 앱별 키맵 규칙(YAML)과 브라우저 **효과 계층 백스톱**(아래 "효과 우회" 행)을 함께 쓴다 `[추론]` |
| **드래그** | Anthropic `left_click_drag`/`left_mouse_down`+`up`, Meta·OpenAI `drag.path[]`, Gemini `drag_and_drop`, `mouse_down`/`up` (§1) | 시작점과 끝점을 둘 다 히트테스트한다. 쪼갠 down/move/up은 상태 머신으로 묶는다. 드롭 대상이 업로드 영역이면 "파일 송신" 정책을 적용한다 `[추론]` |
| **클립보드** | 에이전트가 Ctrl+C/V로 데이터를 다른 앱에 옮길 수 있다 `[추론]` | 샌드박스 클립보드를 프록시가 소유한다(xclip). 붙여넣기 시점의 클립보드 내용을 `type`과 똑같이 정책 검사하고 원장에 남긴다. 앱을 넘나드는 복사는 출처 앱 태그로 taint를 추적한다 `[추론]` |
| **앱 전환**(Spotlight, Alt-Tab, Dock, `open_app`, `navigate`, 링크 새 탭) | Gemini `open_app`/`navigate`, Anthropic 예시 `"alt+Tab"` (§1) | 사전 차단: 알려진 전환 조합키, 의미가 명시된 액션(`navigate` URL, `open_app` 이름). 사후 차단: 액션마다 frontmost 앱/URL을 다시 판정하고, 금지 대상이면 즉시 되돌리고 **스크린샷을 블랭크 처리**한다. 브라우저는 CDP Fetch로 탐색 요청 자체를 차단한다(§4) `[추론]` |
| **canvas 앱**(AX 트리 없음) | Google Docs는 2021년부터 canvas 렌더링이다 `[배포]` https://workspaceupdates.googleblog.com/2021/05/Google-Docs-Canvas-Based-Rendering-Update.html | 일부는 별도 접근성 레이어가 있다. 없으면 VLM 폴백(§2.3)이나 해당 앱을 "보기 전용" 같은 거친 정책으로 묶는다 `[추론]` |
| **iframe / cross-site OOPIF** | cross-origin iframe은 별도 렌더러라 상위 세션에서 보이지 않는다. `Target.setAutoAttach{flatten:true}`로 자식 세션에 붙어야 한다 `[배포]` https://hermes-agent.nousresearch.com/docs/developer-guide/browser-supervisor · https://chromedevtools.github.io/devtools-protocol/tot/Target | 결제 버튼은 흔히 PSP iframe 안에 있다 `[추론]`. `getNodeForLocation`의 `frameId`가 OOPIF면 자식 세션으로 좌표를 바꿔 재질의한다. 해석에 실패하면 **frame origin만으로 정책**을 건다(예: `*.stripe.com` iframe 클릭은 REQUIRE_APPROVAL) |
| **좌표계 불일치** | Retina 2x(Anthropic 문서), UIA 물리 좌표, Gemini 0–999 정규화 | 어댑터에서 단일 "스크린샷 픽셀" 좌표계로 정규화하고, 스케일 계수를 원장에 기록한다 `[추론]` |
| **효과 우회**(같은 효과에 이르는 여러 입력 경로) | 위 행들의 합 | 브라우저 변형에서는 UI 의도 계층에 더해 **네트워크 효과 계층**을 둔다. CDP `Fetch.requestPaused`에서 `failRequest`로 보호 엔드포인트(예: 메일 send POST)를 정책 판정 때까지 멈춘다 `[배포]` https://pkg.go.dev/github.com/chromedp/cdproto/fetch |

### 2.5 신뢰도 판정 `[추론]`
- **브라우저(CDP)**: 앱 식별은 결정적이다. DOM/AX 히트테스트는 일반 웹앱에서 role과 name을 안정적으로 준다. OOPIF와 canvas만 예외다. Fetch 백스톱까지 더하면 **앱별 정책 집행에 충분**하다.
- **데스크톱(AX/UIA/AT-SPI)**: 네이티브 앱은 대체로 쓸 만하다. Electron, 게임, 커스텀 렌더러는 편차가 크다. 데모 수준의 "Send 금지"는 가능하지만 **완전 중재(complete mediation)를 주장하기는 어렵다**.
- 그래서 판정 정확도보다 **기본값(deny-by-default)과 백스톱**이 안전성을 만든다.

---

## 3. 관측 필터링(화면 영역 가리기)

### 3.1 SAM 3 / 3.1이 할 수 있는 것
- 개념: **Promptable Concept Segmentation**. 짧은 명사구나 이미지 예시를 받아 그 개념의 **모든 인스턴스**를 박스와 마스크로 돌려준다. SA-Co 벤치마크에서 기존 대비 약 2배다. `[연구]` https://arxiv.org/abs/2511.16719 · https://ai.meta.com/research/publications/sam-3-segment-anything-with-concepts
- SAM 3.1(2026-03-27)은 object multiplexing으로 한 번의 forward pass에 최대 16개 객체를 추적한다. 비디오 처리량이 H100 기준 16에서 32 fps로 올랐다. **SAM 3 이미지 추론은 H200에서 객체 100개 이상 이미지 한 장에 30 ms**다. `[배포]` https://ai.meta.com/blog/segment-anything-model-3/ · 가중치 https://huggingface.co/facebook/sam3.1 · 코드 https://github.com/facebookresearch/sam3
- Meta Model API의 `sam-3.1` `[배포]`: https://dev.meta.ai/docs/sam/segmenting
  - 호출 형태: `POST /v1/responses`, `model:"sam-3.1"`, `input_text`(명사구 **또는** box/point 토큰) + `input_image`
  - 출력: 스트림 텍스트 `<0f>0<|box;x1=…;y1=…;x2=…;y2=…;w=…;h=…|><|mask;x=0;y=0;data=…|>`
  - 과금: 이미지나 프레임 단위(https://dev.meta.ai/docs/pricing-rate-limits)
- 문서에 명시된 제약 `[배포]`:
  - **요청당 개념 1개.** 쉼표 목록은 0건을 돌려준다.
  - 부정, OR, 공간 표현("person on the left")은 불안정하다.
  - "SAM 3.1 locates the objects you name; it doesn't answer questions or reason about a scene"
  - 장면 이해가 필요하면 Muse Spark로 먼저 개념을 뽑고 SAM으로 넘기라고 권한다.
- UI 스크린샷 적합성:
  - 공식 문서와 블로그 어디에도 UI 위젯("Send button", "text field") 분할 평가가 없다. `[unverified]`
  - Playground 템플릿에 "pixelating faces, license plates, and screens"가 있어(위 블로그) **화면 속 사진이나 실물 류**에는 맞는다. `[배포]`
  - 블로그가 미세한 도메인 밖 개념에서 일반화가 약하다고 스스로 밝힌다. 그래서 "Send button"을 넣으면 **모든 버튼**이 나오거나 0건이 나올 가능성이 높다. 텍스트로 구분하려면 OCR이나 AX가 필요하다. `[추론]`

### 3.2 세 방식 비교
| 방식 | 강점 | 약점 | 지연 |
|---|---|---|---|
| **AX/DOM 박스 마스킹**(CDP `DOM.getBoxModel`/AX 노드 → 스크린샷에 사각형을 칠함) | 셀렉터나 role 규칙("`[data-pii]`", "role=row in #accounts")이 결정적이다. 동적 레이아웃을 따라간다. 히트테스트와 **같은 좌표계**다 `[추론]` | canvas, 이미지 속 텍스트, OOPIF는 안 된다 | CDP 왕복 수 ms~수십 ms `[추론]` |
| **OCR + 정규식**(카드번호, 계좌, 이메일, 주민번호 패턴) | 앱을 가리지 않는다. canvas나 이미지 속 텍스트도 잡는다 | 정규식으로 표현할 수 없는 민감 정보는 못 잡는다. OCR 오류가 곧 누출로 이어진다 | PP-OCRv5 mobile det: CPU 57.77 ms, GPU 10.67 ms(표준 모드) `[배포]` https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/OCR.html · 기술 보고서 https://arxiv.org/abs/2507.05595 |
| **SAM 3.1 텍스트 프롬프트** | 얼굴, 신분증·카드 사진, QR, 서명 같은 **시각 객체**에 강하다. 비디오 추적이 되어 연속 프레임에 마스크를 유지한다 | UI 위젯 의미 구분 근거가 없다(`[unverified]`). 개념 1개당 1요청. API를 쓰면 네트워크 왕복이 더해진다 | 모델 30 ms(H200) `[배포]`, API 왕복은 요청당 수백 ms~1초대로 추정 `[추론]` |
| 참고: OmniParser V2(YOLO + Florence-2) | UI 상호작용 요소 탐지 전용 | Meta 툴링이 아니다 | V1 대비 지연 60% 감소 `[배포]` https://www.microsoft.com/en-us/research/articles/omniparser-v2-turning-any-llm-into-a-computer-use-agent/ |

### 3.3 권장 `[추론]`
1. **1차**: 정책에 셀렉터나 AX 규칙으로 정의된 영역은 DOM/AX 박스로 칠한다. 결정적이다.
2. **2차**: 모든 프레임에 OCR+정규식을 돌린다. PII 패턴과 정책 키워드에 쓴다.
3. **3차(Meta 툴링 쇼케이스)**: 정책에 "시각 개념"(`"credit card"`, `"face"`, `"qr code"`)이 있을 때만 SAM 3.1을 호출한다. 비디오 모드로 연속 스크린샷에 마스크를 추적하면 매 프레임 재요청을 줄일 수 있다(문서의 box/point 프롬프트 + 프레임 추적).
- 순서 원칙: 마스킹은 **모델에게 보내기 전** 마지막 단계에서 한다. `screenshot`과 `zoom`, Gemini/Meta 결과 이미지 모두에 적용한다. 원장에는 원본 해시와 마스킹본 해시를 둘 다 남긴다(§5).
- 가린 영역 안을 클릭하면 기본값을 DENY로 둔다. 에이전트가 보지 못한 것을 조작하지 못하게 하는 일관성 규칙이다.

---

## 4. 샌드박스와 강제("프록시를 통해서만 행동")

### 4.1 옵션 비교
| 옵션 | 내용 | 프록시 강제 관점 |
|---|---|---|
| **Anthropic computer-use-demo** `[배포]` https://github.com/anthropics/claude-quickstarts/tree/main/computer-use-demo | Docker + X11 + VNC(5900), noVNC(6080), Streamlit(8501) | README 원문: "The components are weakly separated: **the agent loop runs in the container being controlled**". 그대로 쓰면 에이전트가 경계 안에 있다. 루프를 밖으로 빼는 수정이 필요하다 |
| **trycua/cua** `[배포]` https://github.com/trycua/cua | gVisor 컨테이너, Lume(macOS VM), `computer-server`(:8000), Cua Driver(MCP/CLI) | Meta 쿡북이 이것을 쓴다. 프록시가 `computer-server` 앞에 서고 컨테이너 포트를 프록시에만 노출하면 된다. 단 쿡북 MCP 브리지의 `run_command`는 빼야 한다 |
| **E2B Desktop** `[배포]` https://github.com/e2b-dev/desktop | 클라우드 마이크로VM 데스크톱, 스트림 URL(`view_only` 지원) | 클라우드 의존이다. 강제는 API 키 보관(프록시만 소유)으로 한다 |
| **OSWorld docker provider** `[연구]` https://github.com/xlang-ai/OSWorld · V2 https://github.com/xlang-ai/OSWorld-V2/blob/main/docs/PROVIDER_SETUP.md | `provider_name="docker"`, 벤치마크 태스크 | 평가용으로 무겁다. 데모 본체로는 과하다 |
| **순수 브라우저(CDP)** | Chromium(헤드풀) + Xvfb + noVNC, 프록시가 CDP 소켓을 단독 소유, `Input.dispatchMouseEvent`/`dispatchKeyEvent` + `Page.captureScreenshot` `[배포]` https://chromedevtools.github.io/devtools-protocol/tot/Page/ | 의미 매핑(§2.5), Fetch 백스톱, OOPIF 처리가 모두 한 프로토콜 안에 있다. 정책 계층 이중화로 Chrome Enterprise `URLBlocklist`/`URLAllowlist`를 쓴다 `[배포]` https://chromeenterprise.google/policies/url-allowlist/. 단 이 정책은 "does not apply to in-page JavaScript URLs with dynamically loaded data" |

### 4.2 강제 원칙 `[추론]`
- 에이전트 루프 프로세스는 **샌드박스 밖**에서 돌린다. 프록시 HTTP 엔드포인트 하나만 볼 수 있게 한다.
- CDP 포트, VNC 쓰기 권한, 셸·코드 실행 도구는 에이전트에게 주지 않는다. Playwright MCP `browser_run_code`, browser-use `evaluate`, Meta 쿡북 `run_command`, OpenAI `exec_py`가 모두 여기에 해당한다.
- Docker 네트워크: 브라우저 컨테이너는 내부 네트워크와 프록시가 통제하는 egress만 쓴다. CDP 포트는 프록시 컨테이너에만 연결한다.
- noVNC는 사람용 `view_only` 관전 + 승인 시 사람 개입으로만 쓴다. E2B `view_only`와 같은 개념이다.

### 4.3 10일 솔로 권장 스택 `[추론]`
**브라우저 우선(CDP)에 데스크톱 확장을 옵션으로 두는 구성**
- 구성요소:
  1. `sandbox` 컨테이너: Chromium(`--force-renderer-accessibility`, enterprise 정책 JSON) + Xvfb + 경량 WM + noVNC
  2. `proxy` (Python/TS 단일 서비스):
     - CDP 클라이언트(Target auto-attach flatten, Fetch, DOM, Accessibility, Input, Page)
     - 벤더 어댑터: Meta `computer`(1순위), Anthropic toolset, OpenAI `ComputerToolset`
     - 정책 엔진: YAML 규칙 `app/origin → {view, click(role,name), keys, type, navigate, region_mask}` → `ALLOW | DENY | REQUIRE_APPROVAL`
     - 실행 직전 재검증(TOCTOU: 노드 정체성 + 패치 SSIM)
     - 관측 필터: DOM 박스 → OCR → (선택) SAM 3.1
     - 원장(§5)
  3. `agent` 러너: Muse Wonder(`muse-wonder-1.0`, `[프리뷰/베타]`) 또는 Muse Spark 1.3 + `{"type":"computer"}`, `previous_response_id` 체이닝
  4. `approver` UI: 대기 중인 액션 카드(크롭 이미지, AX role/name, origin, 정책 규칙 id), 승인/거부. 확장으로 Muse Voice Transcribe 음성 승인
  5. **데모 대상 앱**: 로컬 목업 3종. 메일(Send 금지), 쇼핑(Buy는 승인), 은행(origin 전체 차단). 실서비스 로그인이나 봇 차단 리스크를 피하고 재현 가능하게 하기 위함이다. 옵션으로 실제 사이트 1개
- 데스크톱 확장(옵션, 3일차 이후 여유가 있으면): 같은 컨테이너에 GTK 앱 1개를 두고 AT-SPI `GetAccessibleAtPoint`와 EWMH `_NET_ACTIVE_WINDOW`로 "앱 차단"을 시연한다.

### 4.4 액션당 지연 오버헤드 추정 `[추론]`(실측 전)
| 단계 | fast path | 비고 |
|---|---|---|
| 좌표 정규화 + 정책 평가 | < 1 ms | 순수 계산 |
| CDP `getNodeForLocation` + `getPartialAXTree` (+OOPIF 재질의) | 5–30 ms | 로컬 CDP |
| 실행 직전 재검증(패치 SSIM + 노드 정체성) | < 100 ms | PUSV 보고치 < 0.1초 `[연구]` |
| 스크린샷 캡처 | 30–100 ms | 프록시 없이도 드는 비용 |
| 관측 필터: DOM 박스 + OCR | 15–80 ms | PP-OCRv5 det 수치 근거 |
| 원장(SHA-256 + 서명) | ~1 ms | |
| **합계(fast path)** | **≈ 50–250 ms** | 기준선: 관측-행동 간격 평균 6.51초 `[연구]` → 약 1~4% |
| slow path: SAM 3.1 API(개념당) | +0.3–1.5 s | `[unverified]`, 모델 자체는 30 ms |
| slow path: Muse Spark VLM 분류 | +1–5 s | 민감 앱에서 AX 해석이 불가할 때만 |
| 사람 승인 | 수 초~분 | 정책상 REQUIRE_APPROVAL일 때만 |

---

## 5. 원장(변조 탐지)

- 레코드(JSONL) 필드 `[추론]`:
  - `seq`, `ts`, `prev_hash`
  - `actor`(model id, call_id)
  - `raw_action`(벤더 원문)
  - `normalized_action`
  - `resolution`(origin, frameId, role, name, 창 id)
  - `decision`(rule_id, ALLOW/DENY/APPROVED_BY)
  - `pre_ss_sha256`(원본), `pre_ss_masked_sha256`(모델에게 보낸 것), `post_ss_sha256`
  - `this_hash = SHA256(canonical_json(record_without_this_hash))`
- 서명과 앵커링:
  - 체인 머리(head)를 주기적으로 Ed25519로 서명한다. `[추론]`
  - 이미지 원본은 content-addressed 저장소(`sha256/…png`)에 둔다. 마스킹 전 원본은 암호화해 보관하거나, 정책상 해시만 남긴다. `[추론]`
- 확장(선택):
  - 레코드를 RFC 6962 방식 Merkle 트리로 묶으면 포함 증명과 일관성 증명이 가능하다(https://www.rfc-editor.org/info/rfc6962/). `[배포]`
  - head를 Sigstore Rekor(https://github.com/sigstore/rekor)나 RFC 3161 TSA, OpenTimestamps에 앵커링한다(https://originstamp.com/en/blog/reader/blockchain-timestamp). `[배포]`
  - 이 로그는 "tamper-evident but not tamper-proof"이므로 외부 감시(monitor)가 필요하다(https://github.com/sigstore/rekor-monitor). `[배포]`
- 데모: 원장의 한 바이트를 고친 뒤 `verify` CLI가 깨진 seq를 지목하는 장면은 10초짜리 시연감이다. `[추론]`

---

## 판정

### 권장 아키텍처
```
[Muse Wonder/Spark (Responses, tools:[{type:"computer"}])]   ← 에이전트는 샌드박스 밖
            │ computer_call(actions[])            ▲ computer_call_output(마스킹된 screenshot)
            ▼                                     │
┌──────────────────────── Permission Proxy ────────────────────────┐
│ 벤더 어댑터(Meta/OpenAI/Anthropic/Gemini) → 정규화 액션 IR        │
│ 의미 해석: CDP getNodeForLocation → AX(role,name) → origin/frame  │
│            (OOPIF auto-attach, 실패 시 Muse Spark grounding 폴백) │
│ 정책 엔진: YAML per app/origin → ALLOW/DENY/REQUIRE_APPROVAL      │
│ 키·텍스트 의미화: 포커스 컨텍스트 + 앱 키맵(Ctrl/⌘+Enter=send)    │
│ 실행 직전 재검증(TOCTOU) → CDP Input 실행                         │
│ 효과 백스톱: CDP Fetch.requestPaused(보호 엔드포인트 정지)        │
│ 관측 필터: DOM/AX 박스 → OCR+regex → SAM 3.1(시각 개념)           │
│ 원장: 해시체인 JSONL + 원본/마스킹 스크린샷 해시 + 서명            │
└───────────────┬──────────────────────────────────────┬───────────┘
                │ CDP(단독 소유)                         │ 승인 요청
        [Docker: Chromium + Xvfb + noVNC(view_only)]   [Approver UI / 음성]
```
- Meta 툴링 활용(25%) 매핑:
  - **Muse Wonder/Spark**: 에이전트 본체, Meta 네이티브 `computer` 도구
  - **Muse Spark grounding**: VLM 폴백 판정
  - **SAM 3.1**: 시각 개념 마스킹과 프레임 추적
  - **Muse Glimmer**: 로컬 프라이버시 모드 분류기
  - **Voice Transcribe**: 음성 승인
  - 포지셔닝 문구: Meta 문서가 "safety는 당신 몫"이라고 남겨 둔 driver 계층을 채우는 제품이다.
- 차별점은 Muse Sentinel과 겹치지 않는 축에 둔다(`leakage.md` §5 참고). Sentinel은 커넥터·네트워크 송신 중심이다. 이 프록시는 **벤더 중립 GUI 액션 계층 + 픽셀 단위 관측 마스킹 + 액션-스크린샷 결합 원장**이다. `[추론]`

### 가장 어려운 기술 리스크
- **완전 중재(complete mediation)의 의미 수준 보장**이다. 같은 부작용(전송, 구매)에 이르는 입력 경로가 너무 많다: 버튼 클릭, Ctrl/⌘+Enter, Tab→Space, form Enter, 드래그, 붙여넣기, 새 탭, OOPIF 안 버튼. 여기에 TOCTOU가 겹친다.
  - 픽셀→요소 히트테스트 자체는 브라우저에서 풀린 문제다.
  - 남은 문제는 "이 키 입력이 이 앱에서 무슨 효과인가"와 "본 것과 누른 것이 같은가"다.
  - DOM 주입형 TOCTOU는 시각 검증으로 약 0%밖에 못 잡는다는 연구 결과가 있다(arXiv 2604.18860).
- 완화 `[추론]`:
  1. deny-by-default
  2. 포커스 기반 키 의미화
  3. 실행 직전 노드 정체성 재검증(DOM 기반이라 시각 검증의 맹점을 보완)
  4. **네트워크 효과 계층 백스톱**(CDP Fetch)
  - 이 네 겹을 쌓고, 데모 앱을 브라우저로 한정해 리스크를 관리 가능한 범위로 줄인다. 데스크톱 일반화는 "로드맵"으로 정직하게 표기한다.

### 첫 48시간 프로토타입 순서
1. **(0–8h) 수직 슬라이스**:
   - Docker(Chromium + Xvfb + noVNC)를 띄운다.
   - 프록시가 Meta Responses `computer_call`을 받아 CDP `Input.dispatchMouseEvent`로 실행하고 `Page.captureScreenshot`을 돌려준다.
   - 정책은 아직 ALLOW-all이고, 원장은 해시체인만 붙인다.
   - 목업 메일 앱에서 Muse Spark가 "메일 읽기"를 끝내는 것까지 본다.
2. **(8–20h) 의미 해석과 DENY**:
   - `getNodeForLocation` → `getPartialAXTree`로 `role=button name=Send`를 확정한다.
   - YAML 규칙 DENY와 거부 배너 합성을 붙인다.
   - **Ctrl/⌘+Enter 우회**를 포커스 규칙으로 막고, Fetch 백스톱으로 send POST를 정지시킨다.
   - 테스트 3종: 클릭, 단축키, Tab→Space.
3. **(20–32h) 승인과 TOCTOU**:
   - 쇼핑 목업 Buy를 REQUIRE_APPROVAL로 묶고, 승인 UI 카드를 만든다.
   - 실행 직전 재검증을 넣는다.
   - 공격 페이지로 확인한다: 스크린샷 후 300 ms 뒤 버튼 위치를 바꾸는 스크립트를 돌려 차단되는지 본다.
4. **(32–44h) 관측 마스킹**:
   - 은행 origin을 전면 차단하고 블랭크 스크린샷을 돌려준다.
   - 메일 목록 일부를 DOM 박스로 마스킹하고, OCR 카드번호 정규식을 붙인다.
   - SAM 3.1 `"credit card"`로 이미지 속 카드를 마스킹한다. 성공률과 지연을 실측해 이 문서의 `[unverified]`를 지운다.
5. **(44–48h) 측정**:
   - 원장 `verify` CLI와 액션당 오버헤드 실측(§4.4 표 검증)을 한다.
   - "무단 전송 0건 / 시도 N건" 대시보드를 만든다.
- 48시간 게이트 `[추론]`: 2단계의 **단축키 우회 차단과 Fetch 백스톱이 동작하지 않으면** 피벗한다. 범위를 "읽기 전용 + 관측 마스킹 + 원장"으로 줄인다.
