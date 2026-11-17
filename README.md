# AZ Tank 4P — Multiplayer Maze Tank Arena (Web & Phone Console)

**AZ Tank 4P** là phiên bản web clone của tựa game bắn xe tăng mê cung kinh điển **AZ (Tank Trouble)**, mở rộng lên **tối đa 4 người chơi (4-Player)** với màn hình chọn nhân vật 4 ô lấy cảm hứng từ **Gun Mayhem**, kết hợp hệ thống **Phone Console (biến điện thoại thành tay cầm qua mã QR + WebRTC PeerJS)** chạy hoàn toàn tĩnh trên **GitHub Pages**.

---

## 1. Công nghệ & Ngôn ngữ sử dụng

| Thành phần | Công nghệ / Ngôn ngữ | Vai trò |
| :--- | :--- | :--- |
| **Giao diện** | HTML5, CSS3 | Màn hình Host (`index.html`), tay cầm di động (`controller.html`) và style (`css/style.css`). |
| **Game Engine** | JavaScript (ES Modules thuần) | Kiến trúc module tách biệt trong `js/`, không cần build tool hay framework ngoài. |
| **Đồ họa** | HTML5 Canvas 2D | Vẽ mê cung, xe tăng tùy biến, đạn nảy, tia laser phản xạ, vết bánh xích và hiệu ứng hạt. |
| **Âm thanh** | Web Audio API (`js/sound.js`) | Tổng hợp toàn bộ hiệu ứng âm thanh bằng code (bắn pháo, nảy tường, nhặt đồ, laser, đặt mìn, nổ xe, thắng hiệp). |
| **Multiplayer P2P** | PeerJS `1.5.1` (WebRTC DataChannel) | Kết nối trực tiếp giữa màn hình PC (Host) và tối đa 4 điện thoại (Controller) không cần backend Node.js. |
| **QR Pairing** | QRCode.js `1.0.0` | Tạo mã QR động chứa link `?host=<peerId>` để điện thoại quét và vào phòng ngay lập tức. |
| **Mobile Web APIs** | Wake Lock, Vibration, Storage API | Giữ sáng màn hình điện thoại, phản hồi rung (`haptic`), lưu bố cục tay cầm (`localStorage`) và giữ slot khi tải lại (`sessionStorage`). |
| **Local Test Server** | Node.js `http` (`dev-server.js`) | Serve file tĩnh tại `http://localhost:3000` không cần `npm install`. |

---

## 2. Cấu trúc thư mục dự án

```text
a:\Tank AZ\
├── index.html          # Màn hình chính Host (Floating QR Lobby, Player Setup, Arena, Scoreboard)
├── controller.html     # Giao diện tay cầm trên điện thoại (Slot Picker, Joystick 360°, Layout Editor)
├── css/
│   └── style.css       # Giao diện 4-slot setup, lobby nổi, HUD trận đấu và bảng điểm 4 người
├── js/
│   ├── main.js         # Vòng lặp game 60fps fixed-timestep, điều phối round, va chạm & HUD
│   ├── maze.js         # Sinh mê cung ngẫu nhiên, chọn 4 điểm spawn xa nhau & BFS pathfinding
│   ├── physics.js      # Va chạm xe–tường mượt, va chạm xe–xe & vật lý đạn nảy tường (ricochet)
│   ├── tank.js         # Thực thể Tank & Bullet, tùy biến ngoại hình và logic bắn 6 loại vũ khí
│   ├── powerups.js     # Hòm tiếp tế, Laser phản xạ, Gatling, Homing Missile, Frag Bomb, Shotgun, Mine
│   ├── ai.js           # Bot AI tìm đường BFS, né đạn, nhặt hòm vũ khí & kiểm tra an toàn Laser
│   ├── input.js        # Hợp nhất input từ 4 bộ phím PC + Phone Console WebRTC
│   ├── network.js      # PeerJS Host Manager, quản lý slot P1–P4, chống kẹt phím & gửi haptic/vũ khí
│   ├── particles.js    # Vết bánh xích, vết cháy nổ, khói nòng, tia lửa, sóng xung kích & chữ nổi
│   └── sound.js        # Bộ tổng hợp âm thanh Web Audio API
├── dev-server.js       # Static HTTP server chạy local để test ES Modules
├── start-local.bat     # Script khởi động nhanh server trên Windows
└── README.md           # Tài liệu tổng quan kiến trúc & hướng dẫn sử dụng
```

---

## 3. Thiết kế Giao diện (UI / UX)

### 3.1. Màn hình Host (`index.html`)
- **Floating QR Lobby (`#lobby`)**: Nằm ở góc trên bên trái, hiển thị trạng thái kết nối của 4 slot, mã QR để quét và đường dẫn `open controller tab` để test nhanh trên trình duyệt. Khi bấm `START!`, hộp lobby tự thu gọn để không che khuất mê cung.
- **Player Setup 4 ô (`#setup-screen`)**:
  - Mỗi ô cho phép chuyển đổi linh hoạt giữa `SLOT EMPTY`, `HUMAN PLAYER` hoặc `AI PLAYER`.
  - Khi điện thoại quét QR và chọn slot, ô tương ứng tự động kích hoạt thành `HUMAN PLAYER` và gắn nhãn `📱 PHONE P1..P4`.
  - Hỗ trợ tùy biến trực quan qua Canvas preview: **Màu xe** (8 màu), **Tháp pháo (`HAT`: Classic, Star, Stripe, Crown, Visor)**, **Nòng pháo (`GUN`: Normal, Heavy, Muzzle)**, **Độ khó Bot (`EASY / NORMAL / HARD`)** và **Tên người chơi**.
  - Tùy chọn trận đấu: **Win Score** (`5 / 10 / 15 / Endless`) và **Map Size** (`Small / Medium / Large`).
- **Màn hình Đấu (`#game-screen`)**:
  - Thanh HUD trên cùng: Hiển thị số hiệp, nút đổi map nhanh (`R`), tắt/bật âm thanh và nút quay về Setup (`ESC`).
  - Bảng điểm 4 người phía dưới (`#scoreboard`): Hiển thị màu xe, tên, phương thức điều khiển, vũ khí đặc biệt đang giữ và điểm số; làm mờ các xe đã bị hạ trong hiệp.

### 3.2. Giao diện Tay cầm Điện thoại (`controller.html`)
- **Màn hình chọn Slot**: Hiển thị 4 nút `Player 1–4` đồng bộ tên và màu sắc theo thời gian thực từ Host; khóa các slot đã có người khác chọn.
- **Màn hình Tay cầm**:
  - **Joystick ảo bên trái**: Hỗ trợ 2 chế độ chuyển đổi nhanh bằng nút `Mode`:
    - `DIRECT` (Mặc định): Kéo joystick theo hướng 360° bất kỳ, xe tăng tự xoay mặt và chạy về hướng đó.
    - `CLASSIC`: Lên/Xuống = Tiến/Lùi, Trái/Phải = Xoay thân xe.
  - **Cụm nút bên phải**: Nút `FIRE` cỡ lớn (tự đổi màu, hiển thị tên viết tắt & số đạn của vũ khí đặc biệt đang cầm) và nút `REV` (lùi nhanh). Hỗ trợ đa điểm chạm (`touch.identifier`) và bắt `touchcancel` / `window.touchend` để không bị kẹt nút.
  - **Edit Mode (`⚙️ Layout`)**: Cho phép kéo thả vị trí từng cụm nút theo `%` màn hình, chỉnh kích thước bằng thanh trượt (`0.6x – 2.2x`) và lưu vào `localStorage` (`azTankLayout`).

---

## 4. Logic Gameplay, Vật lý & AI

### 4.1. Sinh mê cung & Điểm xuất phát (`js/maze.js`)
- Sinh mê cung bằng thuật toán **Recursive Backtracker**, sau đó mở thêm ~18% tường nội bộ (braid maze) để tạo các vòng lặp chiến thuật, giúp 4 xe tăng dễ luồn lách và tránh kẹt ngõ cụt.
- Các đoạn tường thẳng hàng được gộp thành đoạn thẳng liên tục (`buildSegments()`) để xe tăng trượt mượt và đạn không bị vấp mép ô lưới.
- `pickSpawnCells()` chọn các vị trí xuất phát cách xa nhau nhất và xoay nòng súng hướng về **hành lang mở** (`getAccessibleNeighbors`), tránh tình trạng vừa vào hiệp đã quay mặt sát tường.

### 4.2. Vật lý Xe tăng & Đạn nảy (`js/physics.js`, `js/tank.js`)
- **Va chạm Xe tăng**: Dùng `resolveCircleMazeCollision()` với 2 vòng lặp thư giãn giúp xe trượt mượt dọc theo tường và góc tường.
- **Đạn nảy tường (Ricochet)**: `stepBulletWithRicochet()` chia nhỏ bước di chuyển theo từng sub-step (`~2.5px/step`) để chống xuyên tường mỏng và tính vector phản xạ chính xác theo pháp tuyến mặt tường hoặc góc tường.
- **Luật AZ chuẩn**: Mỗi xe bắn tối đa 5 viên đạn thường cùng lúc (tồn tại 9 giây); đạn nảy tường có thể tiêu diệt chính người bắn (`leftShooter`).
- **Chống tự bắn đầu hiệp**: Mỗi xe khởi tạo với `shootLatch = true` và `fireCooldown = 0.35s`, kết hợp `resetRoundInputs()` xóa sạch trạng thái phím/nút bắn khi chuyển hiệp mới.
- **Grace Period**: Khi còn `<= 1` xe sống sót, trận đấu chờ thêm **2.2 giây** để xử lý các viên đạn nảy cuối cùng (có thể xảy ra tình huống cùng chết dẫn đến **DRAW**).

### 4.3. Kho vũ khí đặc biệt (`js/powerups.js`)
Hòm tiếp tế (`PowerUpCrate`) xuất hiện định kỳ trên bản đồ (tối đa 3 hòm cùng lúc), cấp ngẫu nhiên 1 trong 6 vũ khí:
1. **`LASER` (1 viên)**: Hiện tia ngắm chấm đỏ phản xạ qua 2 tường; khi bắn tạo tia laser nảy 3 lần tiêu diệt tức thì mọi xe trên đường tia.
2. **`GATLING` (18 viên)**: Nhấn giữ nút bắn để xả liên thanh chùm đạn tốc độ cao.
3. **`HOMING` (1 quả)**: Tên lửa tầm nhiệt kích hoạt sau `0.42s`, tự tìm đường qua mê cung bằng BFS để đuổi theo xe gần nhất.
4. **`FRAG BOMB` (1 quả)**: Bom nảy tường phát nổ sau `1.75s` (hoặc khi va chạm), tách thành 14 mảnh đạn văng 360°.
5. **`SHOTGUN` (2 phát)**: Bắn chùm 7 viên đạn tỏa hình nón.
6. **`MINE` (3 quả)**: Đặt mìn tàng hình phía sau đuôi xe, kích nổ khi có xe đi vào vùng cảm ứng hoặc bị đạn bắn trúng.

### 4.4. Bot AI (`js/ai.js`)
- Dùng BFS trên lưới mê cung để dẫn đường tiếp cận đối thủ gần nhất, hoặc rẽ đường nhặt hòm vũ khí khi đang dùng đạn thường.
- Phát hiện đạn đang bay tới và đánh lái vuông góc để né đạn.
- Kiểm tra tầm nhìn (`hasLineOfSight`) trước khi bắn và tính trước đường phản xạ của tia `LASER` (`computeBouncingLaserPath`) để không tự sát.

---

## 5. Giao thức WebRTC (PeerJS) giữa Host & Controller

| Hướng | Event `type` | Mô tả |
| :--- | :--- | :--- |
| Host → Phone | `playersUpdate` | Danh sách slot đã có người chọn (`taken`) cùng tên và màu hiện tại của 4 slot. |
| Phone → Host | `requestPlayer` | Yêu cầu chiếm slot `1..4`. |
| Host → Phone | `requestPlayerResponse` | Xác nhận cấp slot kèm tên, màu xe hoặc báo lỗi nếu slot đã bị chiếm. |
| Phone → Host | `action` | Gửi trạng thái nút (`up`, `down`, `left`, `right`, `shoot`) dạng `pressed` / `released`. |
| Phone → Host | `joystickVector` | Gửi vector góc lái `(vx, vy)` trong chế độ `DIRECT`. |
| Phone → Host | `leaveSlot` | Giải phóng slot chủ động khi bấm `Leave`. |
| Host → Phone | `weaponUpdate` | Đồng bộ vũ khí đang cầm và số đạn còn lại lên nút `FIRE` của tay cầm. |
| Host → Phone | `haptic` | Kích hoạt rung điện thoại khi xe tăng bị bắn nổ. |
| Host → Phone | `roundReset` | Yêu cầu tay cầm nhả toàn bộ nút đang giữ khi bắt đầu hiệp mới. |

---

## 6. Điều khiển & Cách chạy

### Phím mặc định trên PC
- **Player 1**: `Arrow Keys` + `M` (hoặc `/`)
- **Player 2**: `W A S D` + `Q` (hoặc `Space`)
- **Player 3**: `I J K L` + `P` (hoặc `U`)
- **Player 4**: `Numpad 8 5 4 6` + `Numpad 0` (hoặc `1` / `Enter`)
- **Phím tắt trận đấu**: `R` (Đổi map mới), `ESC` (Quay về Player Setup)

### Chạy trên máy cá nhân (Local)
1. Chạy `node dev-server.js` (hoặc mở `start-local.bat`).
2. Truy cập `http://localhost:3000`.

### Deploy lên GitHub Pages
- Toàn bộ mã nguồn là HTML/CSS/JS tĩnh, chỉ cần push thư mục dự án lên nhánh `main` (hoặc `gh-pages`) và bật **GitHub Pages** trong phần Settings của repository.
