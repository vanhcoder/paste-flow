# Feature 02: Paste Queue (Multi-Copy → Sequential Paste)

> **Tier:** 1 — Build ngay vào MVP
> **Thời gian:** 2-3 ngày
> **Độ khó:** ⭐⭐ (Easy-Medium)
> **Competitor:** 0

---

## 1. Mô tả tính năng

Bật chế độ "Collect" → copy nhiều items liên tiếp → switch sang app đích → mỗi lần Cmd+V = paste item tiếp theo trong queue (FIFO). Khi hết queue → thông báo + tự tắt Collect mode.

**Flow cụ thể:**

```
1. User bấm Cmd+Shift+Q → bật Collect Mode (tray icon đổi màu)
2. Copy item A (tên client)
3. Copy item B (email client)
4. Copy item C (số điện thoại)
5. Copy item D (địa chỉ)
6. Bấm Cmd+Shift+Q lần nữa → kết thúc collect, bắt đầu paste mode
7. Switch sang form cần điền
8. Cmd+V → paste "tên client" (item A)
9. Tab → Cmd+V → paste "email client" (item B)
10. Tab → Cmd+V → paste "số điện thoại" (item C)
11. Tab → Cmd+V → paste "địa chỉ" (item D)
12. Queue hết → notification "Queue complete! 4 items pasted"
13. Tự động về normal mode
```

---

## 2. Pain Point cụ thể

### Freelancer:
- Điền form contract/NDA có 10+ fields → switch qua lại giữa brief và form 10 lần
- Gửi invoice: copy tên, email, amount, date, bank info → paste vào template
- Apply job trên Upwork: copy portfolio links, rate, availability → paste vào proposal form

### E-commerce Seller:
- List sản phẩm mới: copy tên, mô tả, giá, SKU, specs → paste vào listing form
- Mỗi ngày list 20 sản phẩm × 6 fields = 120 lần switch app

### Developer:
- Điền .env file: copy 5-10 API keys từ các dashboard khác nhau
- Fill config form trong admin panel

### MMO / Marketer:
- Setup campaign: copy headline, description, CTA, landing URL, tracking ID
- Điền profile trên nhiều platform cùng lúc

---

## 3. Technical Architecture

### 3.1 Queue State Manager (Rust)

```rust
// src-tauri/src/clipboard/queue.rs

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    pub content: String,
    pub index: usize,      // vị trí trong queue
    pub preview: String,    // 50 chars đầu
    pub collected_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QueueMode {
    Off,         // Normal clipboard mode
    Collecting,  // Đang thu thập items
    Pasting,     // Đang paste tuần tự
}

pub struct PasteQueue {
    items: Arc<Mutex<VecDeque<QueueItem>>>,
    mode: Arc<Mutex<QueueMode>>,
    total_collected: Arc<Mutex<usize>>,
}

impl PasteQueue {
    pub fn new() -> Self {
        Self {
            items: Arc::new(Mutex::new(VecDeque::new())),
            mode: Arc::new(Mutex::new(QueueMode::Off)),
            total_collected: Arc::new(Mutex::new(0)),
        }
    }

    pub fn get_mode(&self) -> QueueMode {
        self.mode.lock().unwrap().clone()
    }

    pub fn start_collecting(&self) {
        *self.mode.lock().unwrap() = QueueMode::Collecting;
        self.items.lock().unwrap().clear();
        *self.total_collected.lock().unwrap() = 0;
    }

    pub fn add_item(&self, content: String) -> usize {
        let mut items = self.items.lock().unwrap();
        let mut total = self.total_collected.lock().unwrap();
        *total += 1;
        let index = *total;

        let preview: String = content.chars().take(50).collect();
        items.push_back(QueueItem {
            content,
            index,
            preview,
            collected_at: chrono::Local::now().to_rfc3339(),
        });

        index
    }

    pub fn finish_collecting(&self) {
        *self.mode.lock().unwrap() = QueueMode::Pasting;
    }

    pub fn pop_next(&self) -> Option<QueueItem> {
        let mut items = self.items.lock().unwrap();
        let item = items.pop_front();

        // Nếu hết items → tự về Off mode
        if items.is_empty() {
            *self.mode.lock().unwrap() = QueueMode::Off;
        }

        item
    }

    pub fn peek_next(&self) -> Option<QueueItem> {
        self.items.lock().unwrap().front().cloned()
    }

    pub fn remaining(&self) -> usize {
        self.items.lock().unwrap().len()
    }

    pub fn total(&self) -> usize {
        *self.total_collected.lock().unwrap()
    }

    pub fn cancel(&self) {
        *self.mode.lock().unwrap() = QueueMode::Off;
        self.items.lock().unwrap().clear();
        *self.total_collected.lock().unwrap() = 0;
    }

    pub fn get_all_items(&self) -> Vec<QueueItem> {
        self.items.lock().unwrap().iter().cloned().collect()
    }
}
```

### 3.2 Tauri Commands

```rust
// src-tauri/src/clipboard/queue_commands.rs

use tauri::{AppHandle, Emitter, State};
use super::queue::{PasteQueue, QueueMode, QueueItem};

#[tauri::command]
pub fn toggle_queue_mode(
    queue: State<'_, PasteQueue>,
    app: AppHandle,
) -> Result<QueueMode, String> {
    let current = queue.get_mode();

    match current {
        QueueMode::Off => {
            queue.start_collecting();
            let _ = app.emit("queue-mode-changed", QueueMode::Collecting);
            Ok(QueueMode::Collecting)
        }
        QueueMode::Collecting => {
            if queue.remaining() == 0 {
                // Không có items → cancel
                queue.cancel();
                let _ = app.emit("queue-mode-changed", QueueMode::Off);
                Ok(QueueMode::Off)
            } else {
                queue.finish_collecting();
                let _ = app.emit("queue-mode-changed", QueueMode::Pasting);
                Ok(QueueMode::Pasting)
            }
        }
        QueueMode::Pasting => {
            queue.cancel();
            let _ = app.emit("queue-mode-changed", QueueMode::Off);
            Ok(QueueMode::Off)
        }
    }
}

#[tauri::command]
pub fn get_queue_status(
    queue: State<'_, PasteQueue>,
) -> Result<QueueStatus, String> {
    Ok(QueueStatus {
        mode: queue.get_mode(),
        total: queue.total(),
        remaining: queue.remaining(),
        next_item: queue.peek_next(),
        all_items: queue.get_all_items(),
    })
}

#[tauri::command]
pub fn queue_paste_next(
    queue: State<'_, PasteQueue>,
    app: AppHandle,
) -> Result<Option<QueueItem>, String> {
    let item = queue.pop_next();

    if let Some(ref i) = item {
        // Set clipboard
        let mut clipboard = arboard::Clipboard::new()
            .map_err(|e| e.to_string())?;
        clipboard.set_text(&i.content)
            .map_err(|e| e.to_string())?;

        // Emit progress
        let _ = app.emit("queue-progress", QueueProgress {
            pasted_index: i.index,
            remaining: queue.remaining(),
            total: queue.total(),
        });

        // Check if queue is now empty
        if queue.remaining() == 0 {
            let _ = app.emit("queue-complete", queue.total());
            let _ = app.emit("queue-mode-changed", QueueMode::Off);
        }
    }

    Ok(item)
}

#[tauri::command]
pub fn cancel_queue(
    queue: State<'_, PasteQueue>,
    app: AppHandle,
) -> Result<(), String> {
    queue.cancel();
    let _ = app.emit("queue-mode-changed", QueueMode::Off);
    Ok(())
}

#[derive(serde::Serialize)]
pub struct QueueStatus {
    mode: QueueMode,
    total: usize,
    remaining: usize,
    next_item: Option<QueueItem>,
    all_items: Vec<QueueItem>,
}

#[derive(serde::Serialize, Clone)]
pub struct QueueProgress {
    pasted_index: usize,
    remaining: usize,
    total: usize,
}
```

### 3.3 Integration với Clipboard Watcher

```rust
// Trong clipboard/watcher.rs — modify the polling loop:

// Khi detect clipboard change:
if queue.get_mode() == QueueMode::Collecting {
    // KHÔNG lưu vào history → lưu vào queue
    let index = queue.add_item(current.clone());
    let _ = app.emit("queue-item-added", QueueItemAdded {
        index,
        preview: current.chars().take(50).collect(),
    });
} else {
    // Normal mode → lưu vào history như bình thường
    save_to_history(&db, &current, &app);
}
```

### 3.4 Override Cmd+V khi ở Paste Mode

```rust
// Khi queue mode = Pasting, override paste behavior:
// Option 1: Global hotkey intercept Cmd+V (phức tạp, có thể conflict)
// Option 2 (RECOMMENDED): Dùng clipboard watcher
//   - Khi pop_next() → set clipboard thành next item
//   - User paste bình thường bằng Cmd+V
//   - Mỗi lần paste → watcher detect clipboard KHÔNG đổi → pop next item

// Approach: dùng timer-based approach
// Sau khi set clipboard = item N, đợi 2 giây
// Nếu user đã paste (clipboard unchanged), auto-set clipboard = item N+1
// Hoặc: User paste bằng Cmd+V bình thường, sau đó bấm hotkey để advance queue
```

---

## 4. Frontend UI

### 4.1 Floating Queue Indicator

```
Collecting mode:                  Pasting mode:
┌─────────────────────┐          ┌─────────────────────┐
│ 📥 Collecting: 3    │          │ 📤 Pasting: 2/5     │
│ ▸ "John Smith"      │          │ Next: "john@..."    │
│ ▸ "john@email.com"  │          │ ████████░░ 60%      │
│ ▸ "+84 912..."      │          │                     │
│                     │          │ [Paste Next] [Skip]  │
│ [Done] [Cancel]     │          │ [Cancel]             │
└─────────────────────┘          └─────────────────────┘
```

### 4.2 System Tray Icon States

```
Normal mode:   📋 (default icon)
Collecting:    📥 (green dot badge) + tooltip "Collecting: 3 items"
Pasting:       📤 (blue dot badge) + tooltip "Pasting: 2/5 remaining"
```

### 4.3 Queue Progress Toast

```
After each paste:
┌────────────────────────────┐
│ ✅ Pasted 3/5: "+84 912..." │
│ Next: "123 Nguyễn Huệ..."  │
└────────────────────────────┘

Queue complete:
┌────────────────────────────┐
│ 🎉 Queue complete!         │
│ 5 items pasted             │
└────────────────────────────┘
```

---

## 5. Hotkey Mapping

```
Cmd+Shift+Q     → Toggle queue mode (Off → Collecting → Pasting → Off)
Cmd+Shift+N     → Paste next item in queue (alternative to auto-advance)
Cmd+Shift+S     → Skip current item
Escape          → Cancel queue
```

---

## 6. Database Schema Addition

```sql
-- Không cần persistent storage — queue là in-memory chỉ
-- Nhưng track usage stats:

CREATE TABLE IF NOT EXISTS queue_usage_logs (
    id          TEXT PRIMARY KEY,
    items_count INTEGER NOT NULL,
    completed   INTEGER DEFAULT 0,  -- 1 = all pasted, 0 = cancelled
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

---

## 7. Build Steps

```
Ngày 1:
  ✅ Implement PasteQueue struct + state management
  ✅ Tauri commands: toggle, status, paste_next, cancel
  ✅ Integrate với clipboard watcher (collect mode)

Ngày 2:
  ✅ Hotkey registration (Cmd+Shift+Q, Cmd+Shift+N)
  ✅ Frontend: floating queue indicator component
  ✅ System tray icon state changes

Ngày 3:
  ✅ Toast notifications cho progress
  ✅ Edge cases: queue cancel, app crash recovery
  ✅ Test with real form-filling workflow
  ✅ Test trên cả macOS + Windows
```

---

## 8. Edge Cases

- **User copy thứ mới khi đang Paste mode** → Hỏi: "Add to queue or replace?"
- **App crash khi đang queue** → Queue mất (in-memory) → OK, không critical
- **Queue item là image** → Bỏ qua, chỉ support text cho MVP
- **Queue quá lớn (>50 items)** → Cảnh báo, suggest dùng template thay vì queue
- **User quên tắt Collect mode** → Auto-timeout sau 5 phút
