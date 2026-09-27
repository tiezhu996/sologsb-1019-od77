import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Button, Checkbox, Chip, Divider, Paper, Typography } from '@suid/material';
import { normalizeQuote } from '../utils/citations';
import type { useCodingStore } from '../store/coding-store';

type Store = ReturnType<typeof useCodingStore>;

interface QuoteTarget {
  segmentId: string;
  quote: string;
  x: number;
  y: number;
}

/** 把当前主题收录过的原文句子在片段中高亮出来。 */
function renderHighlighted(text: string, quotes: string[]): JSX.Element {
  const ranges: Array<[number, number]> = [];
  quotes.forEach((quote) => {
    const needle = normalizeQuote(quote);
    if (!needle || needle.length < 2) return;
    const start = text.indexOf(needle);
    if (start >= 0) ranges.push([start, start + needle.length]);
  });
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  ranges.forEach(([start, end]) => {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  });
  const nodes: JSX.Element[] = [];
  let cursor = 0;
  merged.forEach(([start, end], index) => {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(<mark class="quote-mark">{text.slice(start, end)}</mark>);
    cursor = end;
    if (index === merged.length - 1 && end < text.length) nodes.push(text.slice(end));
  });
  return nodes;
}

export default function TranscriptPanel(props: { store: Store }) {
  const [query, setQuery] = createSignal('');
  const [selected, setSelected] = createSignal<string[]>([]);
  const [batchTheme, setBatchTheme] = createSignal('');
  const [quoteTarget, setQuoteTarget] = createSignal<QuoteTarget | null>(null);
  const [quoteDuplicate, setQuoteDuplicate] = createSignal(false);

  const segments = createMemo(() => props.store.state.segments
    .filter((segment) => segment.transcriptId === props.store.state.activeTranscriptId)
    .filter((segment) => `${segment.speaker} ${segment.text}`.toLowerCase().includes(query().toLowerCase()))
    .sort((a, b) => a.order - b.order));

  const activeTheme = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  const activeThemeQuotes = createMemo(() => {
    const theme = activeTheme();
    return theme ? theme.citations.map((citation) => citation.quote) : [];
  });

  createEffect(() => {
    // 切换访谈或主题时收起引文浮层。
    props.store.state.activeTranscriptId;
    props.store.state.activeThemeId;
    setQuoteTarget(null);
  });

  createEffect(() => {
    if (quoteTarget()) setQuoteDuplicate(false);
  });

  const inspectSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setQuoteTarget(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const quote = selection.toString().trim();
    const container = range.commonAncestorContainer;
    const holder = (container.nodeType === 1 ? container as HTMLElement : container.parentElement)?.closest('[data-segment-id]') as HTMLElement | null;
    if (!holder || !holder.closest('.segment-list') || !quote) {
      setQuoteTarget(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setQuoteTarget({
      segmentId: holder.dataset.segmentId!,
      quote,
      x: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
      y: rect.top
    });
  };

  onMount(() => document.addEventListener('selectionchange', inspectSelection));
  onCleanup(() => document.removeEventListener('selectionchange', inspectSelection));

  const attachQuote = () => {
    const target = quoteTarget();
    const themeId = props.store.state.activeThemeId;
    if (!target || !themeId) return;
    const created = props.store.addCitation(themeId, target.segmentId, target.quote);
    if (created) {
      window.getSelection()?.removeAllRanges();
      setQuoteTarget(null);
    } else {
      setQuoteDuplicate(true);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  };

  const toggleAll = () => {
    const ids = segments().map((segment) => segment.id);
    setSelected(selected().length === ids.length ? [] : ids);
  };

  const assignBatch = () => {
    if (!batchTheme()) return;
    props.store.batchAssign(selected(), 'A', batchTheme());
    setSelected([]);
  };

  return (
    <Paper class="panel transcript-panel" elevation={0}>
      <div class="panel-heading">
        <div>
          <Typography variant="overline">01 / 转写片段</Typography>
          <Typography variant="h6">访谈原文</Typography>
        </div>
        <Chip size="small" label={`${segments().length} 段`} />
      </div>
      <select
        class="native-select full"
        aria-label="选择访谈"
        value={props.store.state.activeTranscriptId}
        onChange={(event) => {
          const transcript = props.store.state.transcripts.find((item) => item.id === event.currentTarget.value);
          if (!transcript) return;
          const first = props.store.state.segments.find((segment) => segment.transcriptId === transcript.id);
          props.store.selectTranscript(transcript.id);
          if (first) props.store.selectSegment(first.id);
        }}
      >
        <For each={props.store.state.transcripts}>{(transcript) => <option value={transcript.id}>{transcript.title}</option>}</For>
      </select>
      <div class="search-row">
        <input class="native-input" placeholder="搜索原文或发言人（/）" value={query()} onInput={(event) => setQuery(event.currentTarget.value)} />
        <Button size="small" onClick={toggleAll}>{selected().length === segments().length && segments().length ? '取消全选' : '全选'}</Button>
      </div>
      <div class="batch-row">
        <select class="native-select" value={batchTheme()} onChange={(event) => setBatchTheme(event.currentTarget.value)}>
          <option value="">批量分配给…</option>
          <For each={props.store.orderedThemes()}>{(theme) => <option value={theme.id}>{theme.name}</option>}</For>
        </select>
        <Button variant="contained" size="small" disabled={!selected().length || !batchTheme()} onClick={assignBatch}>应用</Button>
      </div>
      <div class="quote-hint">选中片段中的文字，即可挂到当前主题下作为原文引文。</div>
      <Divider />
      <div class="segment-list">
        <For each={segments()}>{(segment, index) => {
          const isActive = () => props.store.state.activeSegmentId === segment.id;
          const themeNames = () => [...new Set([...segment.assignments.A, ...segment.assignments.B])]
            .map((id) => props.store.state.themes.find((theme) => theme.id === id)?.name ?? '未知主题');
          return (
            <article
              class="segment-card"
              classList={{ active: isActive() }}
              data-segment-id={segment.id}
              onClick={() => props.store.selectSegment(segment.id)}
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') props.store.selectSegment(segment.id); }}
            >
              <div class="segment-meta">
                <Checkbox
                  size="small"
                  checked={selected().includes(segment.id)}
                  onClick={(event) => { event.stopPropagation(); toggleSelected(segment.id); }}
                  inputProps={{ 'aria-label': `选择片段 ${index() + 1}` }}
                />
                <span class="segment-index">#{index() + 1}</span>
                <span class="segment-time">{segment.time}</span>
                <strong>{segment.speaker}</strong>
                <Show when={segment.assignments.A.join('|') !== segment.assignments.B.join('|')}>
                  <span class="conflict-dot" title="两位编码者判断不一致">分歧</span>
                </Show>
              </div>
              <p>{renderHighlighted(segment.text, activeThemeQuotes())}</p>
              <Show when={themeNames().length}>
                <div class="chip-line"><For each={themeNames()}>{(name) => <Chip size="small" label={name} />}</For></div>
              </Show>
              <Show when={segment.note}><div class="segment-note">编码备忘：{segment.note}</div></Show>
            </article>
          );
        }}</For>
      </div>

      <Portal>
        <Show when={quoteTarget()}>
          {(target) => (
            <div
              class="quote-popover"
              style={{ left: `${target().x}px`, top: `${target().y - 10}px` }}
              onMouseDown={(event) => event.preventDefault()}
            >
              <Show when={activeTheme()} fallback={<span class="quote-popover-hint">先在中间主题树选择一个主题</span>}>
                {(theme) => (
                  <>
                    <button class="quote-popover-button" onClick={attachQuote}>
                      引用到「{theme().name.replace(/^[　]+/, '')}」
                    </button>
                    <Show when={quoteDuplicate()}><span class="quote-popover-hint">该句已收录在此主题下</span></Show>
                  </>
                )}
              </Show>
            </div>
          )}
        </Show>
      </Portal>
    </Paper>
  );
}
