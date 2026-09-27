import type { CodingState, Segment, Theme, ThemeCitation, Transcript } from '../types';

/** 合并连续空白，用于同一片段同一句引文的去重判断。 */
export const normalizeQuote = (text: string) => text.replace(/\s+/g, ' ').trim();

export const createCitation = (segmentId: string, quote: string): ThemeCitation => ({
  id: `c-${crypto.randomUUID()}`,
  segmentId,
  quote: quote.trim(),
  createdAt: new Date().toISOString()
});

/** 兼容旧版本存档：主题可能还没有 citations 字段。 */
export const normalizeState = (state: CodingState): CodingState => {
  state.themes.forEach((theme) => {
    if (!Array.isArray(theme.citations)) theme.citations = [];
  });
  return state;
};

export const buildThemePath = (themeId: string, themeMap: Map<string, Theme>): string => {
  const names: string[] = [];
  let current = themeMap.get(themeId);
  while (current) {
    names.unshift(current.name);
    current = current.parentId ? themeMap.get(current.parentId) : undefined;
  }
  return names.join(' / ') || '未知主题';
};

const transcriptIndexMap = (transcripts: Transcript[]) => {
  const map = new Map<string, number>();
  [...transcripts]
    .sort((a, b) => a.importedAt.localeCompare(b.importedAt))
    .forEach((transcript, index) => map.set(transcript.id, index));
  return map;
};

/** 主题记事按原文顺序排列引文：先访谈、后片段顺序、再句中位置、最后收录时间。 */
export const sortThemeCitations = (
  citations: ThemeCitation[],
  segments: Segment[],
  transcripts: Transcript[]
): Array<ThemeCitation & { segment?: Segment; quoteOffset: number }> => {
  const segmentMap = new Map(segments.map((segment) => [segment.id, segment]));
  const transcriptOrder = transcriptIndexMap(transcripts);
  return citations
    .map((citation) => {
      const segment = segmentMap.get(citation.segmentId);
      return {
        ...citation,
        segment,
        quoteOffset: segment ? segment.text.indexOf(normalizeQuote(citation.quote)) : -1
      };
    })
    .sort((a, b) => {
      const ta = a.segment ? transcriptOrder.get(a.segment.transcriptId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const tb = b.segment ? transcriptOrder.get(b.segment.transcriptId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      const oa = a.segment?.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.segment?.order ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      const qa = a.quoteOffset < 0 ? Number.MAX_SAFE_INTEGER : a.quoteOffset;
      const qb = b.quoteOffset < 0 ? Number.MAX_SAFE_INTEGER : b.quoteOffset;
      if (qa !== qb) return qa - qb;
      return a.createdAt.localeCompare(b.createdAt);
    });
};
