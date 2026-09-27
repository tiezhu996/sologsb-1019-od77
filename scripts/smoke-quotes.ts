import './browser-stubs';
import { useCodingStore } from '../src/store/coding-store';
import { seedState } from '../src/data/seed';

const store = useCodingStore();
const assert = (cond: boolean, msg: string) => { if (!cond) { console.error(`FAIL: ${msg}`); process.exitCode = 1; } else console.log(`ok: ${msg}`); };

// 1. seed carries quotes
assert(store.state.quotes.length === 2, `seed has 2 quotes (got ${store.state.quotes.length})`);

// 2. addQuote + dedup: same theme+segment+text kept once
const before = store.state.quotes.length;
assert(store.addQuote('t-school-choice', 's-002', '后来家里觉得镇上的学校更好，就把我转过去了。') === false, 'duplicate quote rejected');
assert(store.state.quotes.length === before, 'quote count unchanged after duplicate');
assert(store.addQuote('t-school-choice', 's-002', '我是在临河镇长大的。') === true, 'new sentence accepted');
assert(store.state.quotes.filter((q) => q.themeId === 't-school-choice' && q.segmentId === 's-002').length === 2, 'two distinct sentences from same segment kept');

// 3. quotesForTheme orders by original segment order
store.addQuote('t-family', 's-010', '母亲每周寄菜');
store.addQuote('t-family', 's-002', '家里觉得镇上的学校更好');
const ordered = store.quotesForTheme('t-family');
assert(ordered.length === 2 && ordered[0].segment.id === 's-002' && ordered[1].segment.id === 's-010', 'quotes sorted by segment order');
assert(ordered.every((item) => item.segment.time), 'each quote carries its segment timecode');

// 4. merge: source quotes flow into target, duplicates merged
store.addQuote('t-work', 's-010', '母亲每周寄菜'); // same sentence also on t-family
const familyQuoteCount = store.quotesForTheme('t-family').length;
const workQuoteCount = store.quotesForTheme('t-work').length;
store.mergeThemes('t-family', 't-work');
const merged = store.quotesForTheme('t-work');
assert(store.quotesForTheme('t-family').length === 0, 'source theme quotes emptied after merge');
assert(merged.length === familyQuoteCount + workQuoteCount - 1, `merge dedups identical quote (got ${merged.length})`);
assert(merged.filter((q) => q.quote.text === '母亲每周寄菜' && q.quote.segmentId === 's-010').length === 1, 'identical sentence from same segment kept once after merge');

// 5. split: quotes follow their segments into the new theme
const newId = store.splitTheme('t-work', '2.2 家庭迁移支持', ['s-010']) as string;
assert(store.quotesForTheme(newId).every((item) => item.segment.id === 's-010'), 'split moves quotes of moved segments');
assert(store.quotesForTheme('t-work').every((item) => item.segment.id !== 's-010'), 'source keeps only unmoved quotes');

// 6. undo restores quotes (undo the split)
store.undo();
assert(store.quotesForTheme('t-work').some((item) => item.segment.id === 's-010'), 'undo restores quote assignment');

// 7. removeQuote
const target = store.state.quotes.find((q) => q.text === '我是在临河镇长大的。');
const countBeforeRemove = store.state.quotes.length;
store.removeQuote(target!.id);
assert(store.state.quotes.length === countBeforeRemove - 1, 'removeQuote deletes one quote');

// 8. exports embed quotes with their source segment
const json = JSON.parse(store.exportCoding('json'));
const teacherEntry = json.codebook.find((t: any) => t.id === 't-teacher');
assert(teacherEntry.quotes.length === 1, 'codebook theme lists its quotes');
assert(teacherEntry.quotes[0].segment.id === 's-006' && teacherEntry.quotes[0].segment.text.includes('常拿旧地图'), 'quote carries full source segment');
assert(teacherEntry.quotes[0].transcript.title.includes('李岚'), 'quote carries source transcript');
const csv = store.exportCoding('csv');
assert(csv.includes('主题引文（连同来源片段）'), 'csv has quote section');
const quoteLine = csv.split('\n').find((line) => line.includes('常拿旧地图给我们讲河流和城市'));
assert(!!quoteLine && quoteLine.includes('班主任周老师') && quoteLine.includes('00:00:59'), 'csv quote row includes timecode and source segment text');

// 9. deleteTheme drops its quotes
store.deleteTheme('t-teacher');
assert(store.state.quotes.every((q) => q.themeId !== 't-teacher'), 'deleteTheme removes theme quotes');

// 10. seed state itself is well-formed
const seed = seedState();
assert(Array.isArray(seed.quotes) && seed.quotes.length === 2, 'seedState includes quotes array');

console.log(process.exitCode ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
