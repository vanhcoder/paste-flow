# PasteFlow — Feature Roadmap Master Index

> 12 tính năng độc quyền, phân theo 3 tier, tổng ~50-60 ngày dev

---

## Tổng quan Timeline

```
THÁNG 1 (Tuần 1-4): MVP Core
  ├── Clipboard History + Quick Paste + Templates + AI Reformat
  └── (Đã có trong pasteflow-implementation-plan.md)

THÁNG 1-2 (Tuần 3-6): Tier 1 — Unique Features vào MVP
  ├── Feature 01: Context-Aware Smart Paste        (3-4 ngày)
  ├── Feature 02: Paste Queue                      (2-3 ngày)
  ├── Feature 03: Smart Content Detection          (2-3 ngày)
  └── Feature 04: Paste Transforms                 (2 ngày)
  TOTAL: ~10-12 ngày → có thể build song song với MVP

THÁNG 2-3 (Tuần 7-12): Tier 2 — Moat + Retention
  ├── Feature 05: Clipboard Workflows              (5-7 ngày)
  ├── Feature 06: Smart Variables                  (2-3 ngày)
  ├── Feature 07: Paste Analytics                  (3-4 ngày)
  └── Feature 08: OCR Screenshot to Text           (3-4 ngày)
  TOTAL: ~13-18 ngày

THÁNG 4+ (Tuần 12+): Tier 3 — Scale + Revenue
  ├── Feature 09: Team Shared Clipboard            (7-10 ngày)
  ├── Feature 10: Send to Notion/Sheets            (5-7 ngày)
  ├── Feature 11: Sensitive Content Detection      (3-4 ngày)
  └── Feature 12: AI Content Composer              (4-5 ngày)
  TOTAL: ~19-26 ngày
```

---

## Feature Files Index

| # | Feature | File | Tier | Days | Revenue Impact |
|---|---------|------|------|------|----------------|
| 01 | Context-Aware Smart Paste | `tier1-01-context-aware-smart-paste.md` | 1 | 3-4 | Differentiation |
| 02 | Paste Queue | `tier1-02-paste-queue.md` | 1 | 2-3 | Differentiation |
| 03 | Smart Content Detection | `tier1-03-smart-content-detection.md` | 1 | 2-3 | Wow factor |
| 04 | Paste Transforms | `tier1-04-paste-transforms.md` | 1 | 2 | Pro upsell |
| 05 | Clipboard Workflows | `tier2-05-to-08-features.md` | 2 | 5-7 | Pro upsell ★★★ |
| 06 | Smart Variables | `tier2-05-to-08-features.md` | 2 | 2-3 | Pro upsell |
| 07 | Paste Analytics | `tier2-05-to-08-features.md` | 2 | 3-4 | Retention ★★★ |
| 08 | OCR Screenshot | `tier2-05-to-08-features.md` | 2 | 3-4 | Pro upsell |
| 09 | Team Clipboard | `tier3-09-to-12-features.md` | 3 | 7-10 | Team plan ★★★★★ |
| 10 | Send to Notion/Sheets | `tier3-09-to-12-features.md` | 3 | 5-7 | Pro upsell |
| 11 | Sensitive Detection | `tier3-09-to-12-features.md` | 3 | 3-4 | Trust/Security |
| 12 | AI Content Composer | `tier3-09-to-12-features.md` | 3 | 4-5 | Pro upsell ★★★★ |

---

## Pricing Matrix theo Features

```
FREE (kéo user vào):
  ✅ Clipboard history (50 items)
  ✅ 5 templates
  ✅ Basic search
  ✅ Smart Content Detection (view only, no actions)
  ✅ Paste Analytics (basic stats)

PRO $6/tháng hoặc $39 lifetime (individual):
  ✅ Unlimited history (5000 items)
  ✅ Unlimited templates
  ✅ Smart Variables
  ✅ Context-Aware Smart Paste
  ✅ Paste Queue
  ✅ Paste Transforms (tất cả 30+ transforms)
  ✅ Smart Content Detection + Quick Actions
  ✅ Clipboard Workflows (10 rules)
  ✅ OCR Screenshot to Text (20/tháng)
  ✅ AI Reformat (100 calls/tháng)
  ✅ AI Compose (20 calls/tháng)
  ✅ Sensitive Content Detection
  ✅ Full Analytics Dashboard
  ✅ Send to integrations (3 connections)
  ✅ Custom hotkeys

TEAM $15/team/tháng (≤10 members):
  ✅ Everything in Pro
  ✅ Shared template groups
  ✅ Real-time sync
  ✅ Team analytics
  ✅ Admin controls
  ✅ Unlimited integrations
  ✅ Unlimited workflows

BUSINESS $8/user/tháng (11+ users):
  ✅ Everything in Team
  ✅ SSO
  ✅ Audit log
  ✅ Priority support
```

---

## Competitive Moat Summary

```
Competitor nào KHÔNG có cái nào PasteFlow có:

Paste (Mac, $30/yr):
  ❌ Context-Aware Smart Paste
  ❌ Paste Queue
  ❌ Paste Transforms
  ❌ AI Reformat
  ❌ AI Compose
  ❌ Clipboard Workflows
  ❌ Analytics
  ❌ OCR
  ❌ Integrations (Notion/Sheets)
  ❌ Cross-platform (chỉ Apple)

Ditto (Windows, Free):
  ❌ Tất cả 12 features trên
  ❌ Template system
  ❌ AI anything
  ❌ Modern UI

CleanClip (Mac, $13):
  ❌ Tất cả 12 features trên
  ❌ AI anything
  ❌ Cross-platform

CmdOS (Windows):
  ✅ Có smart paste cho Excel (1 phần)
  ❌ 11 features còn lại
  ❌ Cross-platform

TextExpander ($50/yr):
  ✅ Có smart variables (1 phần)
  ❌ Không phải clipboard manager
  ❌ Không có AI
  ❌ Đắt gấp 8 lần

→ PasteFlow là clipboard manager DUY NHẤT có AI + workflows + analytics
  + cross-platform. Đây là moat rõ ràng.
```

---

## Build Priority nếu thời gian có hạn

Nếu chỉ có 6 tuần thay vì 12:

```
MUST HAVE (build vào MVP):
  ✅ 01 Context-Aware Smart Paste  — differentiator #1
  ✅ 04 Paste Transforms           — easy win, high value
  ✅ 03 Smart Content Detection    — wow factor khi demo

SHOULD HAVE (ngay sau MVP):
  ✅ 02 Paste Queue                — unique, high utility
  ✅ 07 Paste Analytics            — retention weapon
  ✅ 11 Sensitive Detection        — trust builder

NICE TO HAVE (khi có user):
  ✅ 05 Clipboard Workflows        — strongest Pro upsell
  ✅ 06 Smart Variables
  ✅ 08 OCR Screenshot
  ✅ 12 AI Compose

LATER (khi có revenue):
  ✅ 09 Team Clipboard             — biggest revenue expansion
  ✅ 10 Send to Notion/Sheets
```
