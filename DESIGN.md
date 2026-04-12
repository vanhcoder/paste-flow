# PasteFlow — macOS Design System

Tài liệu này quy trình các quy chuẩn thiết kế để PasteFlow đạt được trải nghiệm người dùng tương đương với các ứng dụng bản địa trên hệ điều hành macOS.

## 1. Ngôn ngữ thiết kế (Design Language)

- **Vibrancy (Translucency):** Sử dụng `backdrop-filter: blur(40px)` trên Sidebar và các Popup để tạo hiệu ứng xuyên thấu (Glassmorphism).
- **Surface Colors:**
  - Light Mode: `bg-white/80` (Sidebar), `bg-zinc-50` (Content).
  - Dark Mode: `bg-zinc-900/80` (Sidebar), `bg-[#1a1a1a]` (Content).
- **Accent Color:** macOS Blue (#007AFF) làm màu chủ đạo cho các hành động quan trọng và trạng thái active.
- **Corner Radius:**
  - Window: 18px - 22px.
  - Sidebar Items: 10px.
  - Content Cards: 16px.

## 2. Typography

Sử dụng bộ font thay thế cho **SF Pro** (San Francisco):
- **Phụ trách chính:** `Inter` (tối ưu hóa hiển thị trên mọi độ phân giải).
- **Heading/Display:** `Outfit` (tạo sự sang trọng, hiện đại).
- **Cỡ chữ:** Ưu tiên `text-sm` (14px) cho nội dung chính và `text-[13px]` cho metadata để tạo cảm giác "compact" chuẩn desktop app.

## 3. Chuyển động (Animations)

Sử dụng thư viện **Framer Motion** với các tham số:
- **Type:** Spring (Vật lý lò xo).
- **Transition:** 
  - `stiffness: 300`, `damping: 30` cho các chuyển động menu.
  - `duration: 0.2s`, `ease: "easeOut"` cho các hiệu ứng hover.
- **Key effects:**
  - *Smooth Slide*: Khi chuyển tab Sidebar.
  - *Scale & Fade*: Khi popup hiện lên.
  - *List Reordering*: Các item clipboard di chuyển mượt mà khi có nội dung mới.

## 4. Components Layout

- **Sidebar (3-column style):** Layout chia cột rõ ranh, Sidebar bên trái có background mờ ảo.
- **Action Toolbar:** Các icon tối giản (Lucide React) với stroke mỏng (2.0 or 1.5) tương tự SF Symbols.
- **Quick Paste Popup:** Thiết kế tối giản tối đa, tập trung vào ô search và khả năng điều hướng bằng bàn phím.

---

> **Note:** Luôn ưu tiên sự tối giản. Tránh các hiệu ứng đổ bóng quá đậm (harsh shadows), sử dụng layer shadows (`0 10px 30px rgba(0,0,0,0.05)`).
