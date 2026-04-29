import { useState, useRef } from "react";
import {
  BookOpen, Clock, Zap, Layers, AlignLeft, Keyboard, Sparkles,
  ChevronRight, Search, Pin, Trash2, Copy, Hash,
  Calendar, DollarSign, List, Type, FileText,
  ArrowRight, Info, Settings, Plus, Wand2,
} from "lucide-react";

// ── Platform detection ────────────────────────────────────────────────────────
const isMac = navigator.platform.toUpperCase().startsWith("MAC");
const mod = isMac ? "⌘" : "Ctrl";
const shift = isMac ? "⇧" : "Shift";

// ── Section registry ──────────────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: Section[] = [
  { id: "overview",   label: "Overview",          icon: <BookOpen size={14} /> },
  { id: "history",    label: "Clipboard History", icon: <Clock size={14} /> },
  { id: "quickpaste", label: "Quick Paste",        icon: <Zap size={14} /> },
  { id: "templates",  label: "Smart Templates",   icon: <Layers size={14} /> },
  { id: "variables",  label: "Variables",         icon: <Hash size={14} /> },
  { id: "queue",      label: "Queue Mode",        icon: <AlignLeft size={14} /> },
  { id: "ai",         label: "AI Reformat",       icon: <Sparkles size={14} /> },
  { id: "shortcuts",  label: "Keyboard Shortcuts",icon: <Keyboard size={14} /> },
];

// ── Root ──────────────────────────────────────────────────────────────────────

export function HelpGuide() {
  const [active, setActive] = useState("overview");
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollTo = (id: string) => {
    setActive(id);
    const el = document.getElementById(`section-${id}`);
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-[#1a1a1a] overflow-hidden">

      {/* ── Nav sidebar ── */}
      <aside className="w-52 shrink-0 border-r border-zinc-200/40 dark:border-zinc-800/40 flex flex-col py-5">
        <p className="px-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
          Contents
        </p>
        <nav className="flex-1 px-3 space-y-0.5">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all ${
                active === s.id
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <span className={active === s.id ? "text-blue-500" : "text-zinc-400"}>
                {s.icon}
              </span>
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Content ── */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto hide-scrollbar"
      >
        <div className="max-w-2xl mx-auto px-8 py-8 space-y-16">

          {/* ═══ OVERVIEW ═══════════════════════════════════════════════════ */}
          <Section id="overview" title="Overview" icon={<BookOpen size={18} />}>
            <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <strong className="text-zinc-900 dark:text-zinc-100">PasteFlow</strong> là clipboard manager giúp bạn lưu, tổ chức và dán nội dung nhanh hơn — từ lịch sử clipboard đến template thông minh với biến số.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { icon: <Clock size={16} />, title: "Clipboard History", desc: "Lưu mọi thứ bạn copy, tìm kiếm và dán lại bất kỳ lúc nào" },
                { icon: <Zap size={16} />, title: "Quick Paste", desc: "Popup tìm kiếm cực nhanh, mở bằng phím tắt toàn cục" },
                { icon: <Layers size={16} />, title: "Smart Templates", desc: "Template tái sử dụng với biến số, ngày tháng tự động" },
                { icon: <AlignLeft size={16} />, title: "Queue Mode", desc: "Copy nhiều thứ, dán tuần tự từng cái một" },
                { icon: <Sparkles size={16} />, title: "AI Reformat", desc: "Viết lại text bằng AI — email, Slack, tweet, bullets, tóm tắt" },
              ].map(f => (
                <div key={f.title} className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-700/40">
                  <div className="flex items-center gap-2 mb-2 text-blue-500">{f.icon}<span className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200">{f.title}</span></div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ═══ CLIPBOARD HISTORY ══════════════════════════════════════════ */}
          <Section id="history" title="Clipboard History" icon={<Clock size={18} />}>
            <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Mọi thứ bạn <kbd className="kbd">{isMac ? "⌘C" : "Ctrl+C"}</kbd> đều được lưu tự động. Không cần làm gì thêm.
            </p>

            <FeatureList items={[
              { icon: <Search size={13} />, title: "Tìm kiếm",       desc: "Gõ để lọc theo nội dung. Tìm kiếm fuzzy — không cần gõ chính xác." },
              { icon: <Pin size={13} />,    title: "Pin item",        desc: "Ghim những item hay dùng để chúng luôn hiển thị đầu danh sách." },
              { icon: <Copy size={13} />,   title: "Copy lại",        desc: "Click vào item để copy lại vào clipboard." },
              { icon: <Trash2 size={13} />, title: "Xóa / Clear all", desc: "Xóa từng item hoặc xóa toàn bộ lịch sử qua nút Clear." },
            ]} />

            <Tip>
              Clipboard history được lưu <strong>hoàn toàn local</strong> trên máy bạn. Không upload lên bất kỳ đâu.
            </Tip>
          </Section>

          {/* ═══ QUICK PASTE ════════════════════════════════════════════════ */}
          <Section id="quickpaste" title="Quick Paste" icon={<Zap size={18} />}>
            <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Popup tìm kiếm toàn cục — mở bất cứ đâu, dán vào bất kỳ app nào mà không cần chuyển qua PasteFlow.
            </p>

            <div className="my-4 p-4 bg-zinc-900 dark:bg-zinc-950 rounded-xl text-center">
              <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-widest font-bold">Mở Quick Paste</p>
              <div className="flex items-center justify-center gap-2">
                <Kbd>{mod}</Kbd><span className="text-zinc-600">+</span>
                <Kbd>{shift}</Kbd><span className="text-zinc-600">+</span>
                <Kbd>V</Kbd>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">Có thể đổi phím tắt trong Preferences → Hotkeys</p>
            </div>

            <FeatureList items={[
              { icon: <Search size={13} />,  title: "Tìm đồng thời",   desc: "Tìm cả clipboard history lẫn templates trong cùng một ô search." },
              { icon: <Pin size={13} />,      title: "Pinned Templates", desc: "Template được pin hiển thị đầu danh sách với icon ghim." },
              { icon: <Zap size={13} />,      title: "Variables flow",   desc: "Template có biến số → popup nhập biến → preview → Paste." },
            ]} />

            <SubSection title="Điều hướng bằng bàn phím">
              <ShortcutTable rows={[
                ["↑ ↓",                 "Di chuyển giữa các kết quả"],
                ["Enter",               "Dán item đang chọn"],
                [`${mod} + 1–9`,        "Dán nhanh theo số thứ tự"],
                ["Esc",                 "Đóng popup"],
              ]} />
            </SubSection>
          </Section>

          {/* ═══ SMART TEMPLATES ════════════════════════════════════════════ */}
          <Section id="templates" title="Smart Templates" icon={<Layers size={18} />}>
            <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Template là đoạn text tái sử dụng. Có thể chứa biến số để điền thông tin khác nhau mỗi lần dùng.
            </p>

            <SubSection title="Tạo template">
              <ol className="space-y-2 text-[13px] text-zinc-600 dark:text-zinc-400">
                {[
                  'Vào tab "Smart Templates" → nhấn "New Template"',
                  "Đặt tiêu đề cho template",
                  "Nhập nội dung. Dùng {{tên_biến}} cho phần cần điền",
                  "Chọn Collection (nhóm) nếu muốn",
                  'Nhấn "Save Template"',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </SubSection>

            <SubSection title="Collections (nhóm)">
              <p className="text-[13px] text-zinc-500 leading-relaxed">
                Tổ chức template theo nhóm — Email, Code, HR, v.v. Tạo nhóm mới bằng nút <strong>New Collection</strong> trong sidebar trái của trang Templates.
              </p>
            </SubSection>

            <SubSection title="Pin template">
              <p className="text-[13px] text-zinc-500 leading-relaxed">
                Template được pin sẽ hiển thị <strong>đầu danh sách</strong> trong Quick Paste (ngay cả khi không tìm kiếm). Dùng icon <Pin size={12} className="inline" /> để pin/unpin.
              </p>
            </SubSection>
          </Section>

          {/* ═══ VARIABLES ══════════════════════════════════════════════════ */}
          <Section id="variables" title="Variables — Biến số trong Template" icon={<Hash size={18} />}>
            <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Biến số cho phép template có phần thay đổi mỗi lần dùng. Khi dùng template có biến, một form sẽ hiện ra để nhập giá trị.
            </p>

            <SubSection title="Cú pháp cơ bản">
              <div className="space-y-2">
                <CodeBlock>{`{{tên_biến}}`}</CodeBlock>
                <CodeBlock>{`{{tên_biến:kiểu}}`}</CodeBlock>
                <CodeBlock>{`{{tên_biến:kiểu:tùy_chọn}}`}</CodeBlock>
              </div>
              <p className="text-[12px] text-zinc-400 mt-2">Dùng Variable Helper trong editor để chèn nhanh mà không cần nhớ cú pháp.</p>
            </SubSection>

            <SubSection title="Các kiểu biến (user input)">
              <div className="space-y-2">
                {[
                  { icon: <Type size={13} />,        type: "text",      syntax: "{{ho_ten}}",                      desc: "Ô nhập văn bản 1 dòng (mặc định)" },
                  { icon: <FileText size={13} />,    type: "multiline", syntax: "{{noi_dung:multiline}}",           desc: "Textarea nhiều dòng" },
                  { icon: <List size={13} />,        type: "select",    syntax: "{{gioi_tinh:select:Anh,Chị,Bạn}}", desc: "Dropdown chọn từ danh sách" },
                  { icon: <Calendar size={13} />,   type: "date",      syntax: "{{ngay_hen:date}}",               desc: "Bộ chọn ngày (date picker)" },
                  { icon: <Hash size={13} />,        type: "number",    syntax: "{{so_luong:number}}",             desc: "Số có format phân cách hàng nghìn" },
                  { icon: <DollarSign size={13} />, type: "currency",  syntax: "{{gia:currency:VND}}",            desc: "Số tiền có ký hiệu (VND/USD/EUR/JPY)" },
                  { icon: <Hash size={13} />,        type: "percent",   syntax: "{{chiet_khau:percent}}",          desc: "Nhập số → hiển thị dạng %" },
                ].map(v => (
                  <div key={v.type} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/40 dark:border-zinc-700/30">
                    <span className="text-blue-400 mt-0.5 shrink-0">{v.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{v.type}</span>
                        <code className="text-[10px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{v.syntax}</code>
                      </div>
                      <p className="text-[11px] text-zinc-500">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SubSection>

            <SubSection title="Biến tự động (Built-in) — không cần nhập">
              <div className="space-y-1.5">
                {[
                  { var: "{{TODAY}}",           example: "13/04/2026",           desc: "Ngày hôm nay" },
                  { var: "{{NOW}}",             example: "13/04/2026 14:30",     desc: "Ngày và giờ hiện tại" },
                  { var: "{{WEEKDAY}}",         example: "Sunday",               desc: "Thứ trong tuần (tiếng Anh)" },
                  { var: "{{MONTH}}",           example: "April",                desc: "Tháng hiện tại" },
                  { var: "{{YEAR}}",            example: "2026",                 desc: "Năm hiện tại" },
                  { var: "{{CLIPBOARD}}",       example: "(nội dung clipboard)", desc: "Giá trị clipboard lúc paste" },
                ].map(b => (
                  <div key={b.var} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <code className="text-[12px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0 w-44">{b.var}</code>
                    <ArrowRight size={11} className="text-zinc-300 shrink-0" />
                    <span className="text-[11px] text-zinc-500 flex-1">{b.desc}</span>
                    <span className="text-[10px] text-zinc-400 font-mono shrink-0">{b.example}</span>
                  </div>
                ))}
              </div>

              <Tip>
                Built-in variables dùng chữ HOA. User variables dùng chữ thường. PasteFlow phân biệt hai loại này tự động.
              </Tip>
            </SubSection>

            <SubSection title="Ví dụ template thực tế">
              <CodeBlock label="Email chào hàng">{`Xin chào {{ho_ten}},

Cảm ơn bạn đã quan tâm đến {{san_pham:select:Gói Basic,Gói Pro,Gói Enterprise}}.

Giá hiện tại: {{gia:currency:VND}} (giảm {{chiet_khau:percent}}).

Ưu đãi có hiệu lực đến: {{han_uu_dai:date}}.

Trân trọng,
{{ten_nguoi_gui}}`}</CodeBlock>

              <CodeBlock label="Báo cáo nhanh">{`Báo cáo ngày {{TODAY}} — {{WEEKDAY}}

Người thực hiện: {{ten}}
Dự án: {{du_an}}
Tiến độ: {{tien_do:percent}}
Ghi chú: {{ghi_chu:multiline}}`}</CodeBlock>
            </SubSection>
          </Section>

          {/* ═══ QUEUE MODE ═════════════════════════════════════════════════ */}
          <Section id="queue" title="Queue Mode — Dán tuần tự" icon={<AlignLeft size={18} />}>
            <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Queue Mode cho phép copy nhiều thứ cùng lúc, sau đó dán từng cái một theo thứ tự — cực kỳ hữu ích khi điền form, chuyển dữ liệu giữa các ô, hay làm việc với nhiều trường liên tiếp.
            </p>

            <SubSection title="Cách dùng">
              <ol className="space-y-3 text-[13px] text-zinc-600 dark:text-zinc-400">
                {[
                  { key: `${mod}+${shift}+Q`, desc: "Bật Queue Mode. Biểu tượng nhỏ xuất hiện ở góc màn hình." },
                  { key: isMac ? "⌘+C" : "Ctrl+C", desc: "Copy bình thường — mỗi lần copy sẽ thêm vào hàng đợi." },
                  { key: `${mod}+${shift}+Q`, desc: "Nhấn lần 2 để chuyển sang Paste Mode (bắt đầu dán)." },
                  { key: `${mod}+${shift}+N`, desc: "Dán item tiếp theo từ hàng đợi vào vị trí con trỏ." },
                  { key: `${mod}+${shift}+Q`, desc: "Nhấn lần 3 để hủy và thoát Queue Mode." },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <div>
                      <Kbd small>{step.key}</Kbd>
                      <span className="text-zinc-500 ml-2">{step.desc}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </SubSection>

            <Tip>
              Indicator nhỏ ở góc màn hình hiển thị số item còn lại và preview item tiếp theo.
              Kéo thả indicator để đặt ở vị trí thuận tiện.
            </Tip>
          </Section>

          {/* ═══ AI REFORMAT ════════════════════════════════════════════════ */}
          <Section id="ai" title="AI Reformat" icon={<Sparkles size={18} />}>
            <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Dùng AI để viết lại, chuẩn hóa hoặc chuyển đổi giọng văn của bất kỳ đoạn text nào — email chuyên nghiệp, Slack message, tweet, bullet points, v.v. — chỉ trong một click.
            </p>

            <SubSection title="Thiết lập ban đầu">
              <ol className="space-y-2.5 text-[13px] text-zinc-600 dark:text-zinc-400">
                {[
                  { step: "Vào Preferences → AI Integration", detail: "Chọn provider: OpenAI hoặc Anthropic." },
                  { step: "Dán API key vào ô API Key", detail: 'OpenAI key bắt đầu bằng "sk-…". Anthropic key bắt đầu bằng "sk-ant-…".' },
                  { step: "Chọn model phù hợp", detail: "GPT-4o mini / Claude Haiku nhanh và rẻ. GPT-4o / Claude Sonnet mạnh hơn." },
                  { step: "Nhấn Save AI Settings", detail: "Mỗi provider lưu key riêng — có thể đổi qua lại bất kỳ lúc nào." },
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <div>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{s.step}</span>
                      <p className="text-[12px] text-zinc-400 mt-0.5">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </SubSection>

            <SubSection title="Các style có sẵn">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: "📧", name: "Email",       desc: "Email công việc đầy đủ: Subject, greeting, body, sign-off" },
                  { emoji: "💬", name: "Slack",        desc: "Ngắn gọn, conversational, có bullet khi cần" },
                  { emoji: "𝕏",  name: "Tweet",        desc: "Dưới 280 ký tự, hook mạnh, có hashtag nếu phù hợp" },
                  { emoji: "👔", name: "Formal",       desc: "Văn phong trang trọng, chính xác — phù hợp báo cáo, văn thư" },
                  { emoji: "😊", name: "Casual",       desc: "Giọng thân thiện, tự nhiên như nói chuyện" },
                  { emoji: "•",  name: "Bullets",      desc: "Chuyển thành danh sách có cấu trúc, dễ đọc" },
                  { emoji: "📝", name: "Summary",      desc: "Tóm tắt 3–5 câu, giữ ý chính" },
                  { emoji: "✓",  name: "Fix Grammar",  desc: "Sửa lỗi chính tả, ngữ pháp — giữ nguyên giọng văn" },
                ].map(s => (
                  <div key={s.name} className="flex items-start gap-2.5 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/40 dark:border-zinc-700/30">
                    <span className="text-[16px] leading-none mt-0.5 shrink-0">{s.emoji}</span>
                    <div>
                      <p className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">{s.name}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SubSection>

            <SubSection title="Cách dùng cơ bản">
              <div className="space-y-2 text-[13px] text-zinc-600 dark:text-zinc-400">
                {[
                  { icon: <Copy size={13} />,      text: "Dán text vào ô Input bên trái (hoặc nhấn Paste from Clipboard)" },
                  { icon: <Sparkles size={13} />,  text: "Chọn style muốn áp dụng từ thanh chip phía trên" },
                  { icon: <Wand2 size={13} />,     text: `Nhấn "Reformat" hoặc nhấn ${isMac ? "⌘↵" : "Ctrl+Enter"} để chạy AI` },
                  { icon: <Copy size={13} />,      text: 'Kết quả hiển thị bên phải — nhấn "Copy" hoặc "Paste ⚡" để dùng ngay' },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/40 dark:border-zinc-700/30">
                    <span className="text-blue-400 mt-0.5 shrink-0">{s.icon}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
              </div>
            </SubSection>

            <SubSection title="Custom Skills — Tạo style riêng">
              <p className="text-[13px] text-zinc-500 leading-relaxed mb-3">
                Ngoài 8 style có sẵn, bạn có thể tạo skill tùy chỉnh với system prompt riêng để AI xử lý theo đúng yêu cầu của bạn.
              </p>
              <div className="space-y-2">
                {[
                  { icon: <Plus size={13} />,     title: 'Nhấn "+ Skill"', desc: "Nút dạng dashed border ở cuối thanh style picker." },
                  { icon: <Sparkles size={13} />, title: "Điền thông tin",  desc: "Chọn emoji, đặt tên skill, viết system prompt mô tả cách AI nên xử lý text." },
                  { icon: <Settings size={13} />, title: "Xóa skill",       desc: "Hover lên chip skill tùy chỉnh → nhấn nút ✕ đỏ xuất hiện ở góc." },
                ].map(s => (
                  <div key={s.title} className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/40 dark:border-zinc-700/30">
                    <span className="text-blue-400 mt-0.5 shrink-0">{s.icon}</span>
                    <div>
                      <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300 mr-2">{s.title}</span>
                      <span className="text-[12px] text-zinc-500">{s.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <CodeBlock label="Ví dụ system prompt cho skill &quot;Dịch sang tiếng Việt&quot;">{`Bạn là dịch giả chuyên nghiệp Anh–Việt. Dịch toàn bộ nội dung input sang tiếng Việt tự nhiên, giữ nguyên ý nghĩa và giọng văn của tác giả. Không giải thích, không thêm nội dung — chỉ xuất bản dịch.`}</CodeBlock>
            </SubSection>

            <SubSection title="Generate Template bằng AI">
              <p className="text-[13px] text-zinc-500 leading-relaxed">
                Trong tab Smart Templates, nhấn nút <strong>Generate with AI</strong> (dashed) phía trên ô Title. Mô tả template bạn muốn bằng tiếng Việt hoặc tiếng Anh — AI sẽ tạo tự động title và nội dung có sẵn biến số.
              </p>
              <CodeBlock label="Ví dụ mô tả">{`Template báo giá cho khách hàng, có tên công ty, tên dịch vụ, giá tiền VND và ngày hiệu lực`}</CodeBlock>
            </SubSection>

            <SubSection title="Lịch sử reformat">
              <p className="text-[13px] text-zinc-500 leading-relaxed">
                Nhấn nút <strong>History</strong> ở góc trên phải màn hình AI Reformat để xem 10 lần reformat gần nhất. Click vào bất kỳ mục nào để load lại input và output tương ứng.
              </p>
            </SubSection>

            <Tip>
              API key được lưu <strong>hoàn toàn local</strong> trên máy, không bao giờ rời khỏi thiết bị của bạn ngoài lúc gọi trực tiếp đến API của OpenAI/Anthropic.
            </Tip>
          </Section>

          {/* ═══ SHORTCUTS ══════════════════════════════════════════════════ */}
          <Section id="shortcuts" title="Keyboard Shortcuts" icon={<Keyboard size={18} />}>
            <SubSection title="Toàn cục (hoạt động mọi nơi)">
              <ShortcutTable rows={[
                [`${mod}+${shift}+V`, "Mở/đóng Quick Paste popup"],
                [`${mod}+${shift}+Q`, "Bật / chuyển trạng thái Queue Mode"],
                [`${mod}+${shift}+N`, "Dán item tiếp theo từ queue"],
              ]} />
              <p className="text-[11px] text-zinc-400 mt-2">
                Tất cả phím tắt toàn cục có thể tùy chỉnh trong <strong>Preferences → Global Hotkeys</strong>.
              </p>
            </SubSection>

            <SubSection title="Trong Quick Paste popup">
              <ShortcutTable rows={[
                ["↑ / ↓",             "Di chuyển lên/xuống"],
                ["Enter",             "Dán item đang chọn"],
                [`${mod} + 1–9`,      "Dán nhanh theo số thứ tự hiển thị"],
                ["Esc",               "Đóng popup"],
                ["C",                 "Copy (trong màn hình preview)"],
                ["Backspace",         "Quay lại (trong màn hình preview)"],
              ]} />
            </SubSection>

            <SubSection title="Trong màn hình nhập biến (template)">
              <ShortcutTable rows={[
                ["Tab",    "Chuyển sang ô biến tiếp theo"],
                ["Enter",  "Xác nhận và đến bước preview"],
                ["Esc",    "Đóng / hủy"],
              ]} />
            </SubSection>

            <SubSection title="Trong AI Reformat">
              <ShortcutTable rows={[
                [isMac ? "⌘↵" : "Ctrl+Enter", "Chạy Reformat"],
              ]} />
            </SubSection>

            {isMac && (
              <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/40 dark:border-zinc-700/30">
                <p className="text-[11px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Ký hiệu macOS</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {[
                    ["⌘", "Command"],
                    ["⇧", "Shift"],
                    ["⌥", "Option"],
                    ["⌃", "Control"],
                  ].map(([sym, name]) => (
                    <div key={sym} className="flex items-center gap-2">
                      <Kbd small>{sym}</Kbd>
                      <span className="text-[11px] text-zinc-500">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ id, title, icon, children }: {
  id: string; title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`} className="scroll-mt-6">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="text-blue-500">{icon}</span>
        <h2 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-1.5">
        <ChevronRight size={10} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function FeatureList({ items }: { items: { icon: React.ReactNode; title: string; desc: string }[] }) {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.title} className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/40 dark:border-zinc-700/30">
          <span className="text-blue-400 mt-0.5 shrink-0">{item.icon}</span>
          <div>
            <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300 mr-2">{item.title}</span>
            <span className="text-[12px] text-zinc-500">{item.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShortcutTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-700/40 overflow-hidden">
      {rows.map(([key, desc], i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-4 py-2.5 ${
            i !== rows.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""
          }`}
        >
          <div className="flex items-center gap-1 shrink-0 w-44">
            {key.split("+").map((k, j, arr) => (
              <span key={j} className="flex items-center gap-1">
                <Kbd small>{k.trim()}</Kbd>
                {j < arr.length - 1 && <span className="text-zinc-400 text-[10px]">+</span>}
              </span>
            ))}
          </div>
          <span className="text-[12px] text-zinc-600 dark:text-zinc-400">{desc}</span>
        </div>
      ))}
    </div>
  );
}

function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-700/40">
      {label && (
        <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200/60 dark:border-zinc-700/40">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
        </div>
      )}
      <pre className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/60 text-[12.5px] font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-blue-50/60 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-700/20 rounded-xl">
      <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
      <p className="text-[12px] text-blue-700 dark:text-blue-400 leading-relaxed">{children}</p>
    </div>
  );
}

function Kbd({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <kbd className={`inline-flex items-center justify-center px-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 font-mono font-bold text-zinc-700 dark:text-zinc-300 shadow-sm ${small ? "text-[9px] py-0.5 min-w-[20px]" : "text-[11px] py-1 min-w-[28px]"}`}>
      {children}
    </kbd>
  );
}
