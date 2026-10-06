import { createPublication, listPublications } from "@/lib/db/queries";

/**
 * The eight publications observed live on epaper.charhdikala.com.
 * Two mastheads across three regions, plus Educater and the magazine.
 */
const PUBLICATIONS = [
  { slug: "chardikala-punjab",  name: "Chardikala Punjab",            name_local: "ਚੜ੍ਹਦੀਕਲਾ ਪੰਜਾਬ",   language: "pa", region: "Punjab",  sort_order: 1 },
  { slug: "chardikala-haryana", name: "Chardikala Haryana",           name_local: "ਚੜ੍ਹਦੀਕਲਾ ਹਰਿਆਣਾ", language: "pa", region: "Haryana", sort_order: 2 },
  { slug: "chardikala-delhi",   name: "Chardikala Delhi",             name_local: "ਚੜ੍ਹਦੀਕਲਾ ਦਿੱਲੀ",  language: "pa", region: "Delhi",   sort_order: 3 },
  { slug: "bdh-punjab",         name: "Bharat Desh Hamara Punjab",    name_local: "भारत देश हमारा पंजाब",  language: "hi", region: "Punjab",  sort_order: 4 },
  { slug: "bdh-haryana",        name: "Bharat Desh Hamara Haryana",   name_local: "भारत देश हमारा हरियाणा", language: "hi", region: "Haryana", sort_order: 5 },
  { slug: "bdh-delhi",          name: "Bharat Desh Hamara Delhi",     name_local: "भारत देश हमारा दिल्ली",  language: "hi", region: "Delhi",   sort_order: 6 },
  { slug: "educater-delhi",     name: "Educater Delhi",               name_local: null,                 language: "en", region: "Delhi",   sort_order: 7 },
  { slug: "charhdikala-magazine", name: "Charhdikala Magazine",       name_local: "ਚੜ੍ਹਦੀਕਲਾ ਮੈਗਜ਼ੀਨ", language: "pa", region: null,      sort_order: 8 },
] as const;

const existing = new Set(listPublications(true).map((p) => p.slug));
let added = 0;
for (const p of PUBLICATIONS) {
  if (existing.has(p.slug)) continue;
  createPublication({ ...p });
  added++;
}
console.log(`  publications: ${added} added, ${existing.size} already present`);
for (const p of listPublications()) {
  console.log(`    ${p.sort_order}. ${p.slug.padEnd(24)} ${p.language}  ${p.name_local ?? p.name}`);
}
