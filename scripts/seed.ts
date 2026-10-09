import { upsertPublication, listPublications } from "@/lib/db/queries";

/**
 * The eight publications observed live on epaper.charhdikala.com.
 * Two mastheads across three regions, plus Educater and the magazine.
 */
const PUBLICATIONS = [
  { slug: "chardikala-punjab",  name: "Chardikala Punjab",            name_local: "ਚੜ੍ਹਦੀਕਲਾ ਪੰਜਾਬ", group_name: "ਚੜ੍ਹਦੀਕਲਾ",   language: "pa", region: "Punjab",  sort_order: 1 },
  { slug: "chardikala-haryana", name: "Chardikala Haryana",           name_local: "ਚੜ੍ਹਦੀਕਲਾ ਹਰਿਆਣਾ", group_name: "ਚੜ੍ਹਦੀਕਲਾ", language: "pa", region: "Haryana", sort_order: 2 },
  { slug: "chardikala-delhi",   name: "Chardikala Delhi",             name_local: "ਚੜ੍ਹਦੀਕਲਾ ਦਿੱਲੀ", group_name: "ਚੜ੍ਹਦੀਕਲਾ",  language: "pa", region: "Delhi",   sort_order: 3 },
  { slug: "bdh-punjab",         name: "Bharat Desh Hamara Punjab",    name_local: "भारत देश हमारा पंजाब", group_name: "भारत देश हमारा",  language: "hi", region: "Punjab",  sort_order: 5 },
  { slug: "bdh-haryana",        name: "Bharat Desh Hamara Haryana",   name_local: "भारत देश हमारा हरियाणा", group_name: "भारत देश हमारा", language: "hi", region: "Haryana", sort_order: 6 },
  { slug: "bdh-delhi",          name: "Bharat Desh Hamara Delhi",     name_local: "भारत देश हमारा दिल्ली", group_name: "भारत देश हमारा",  language: "hi", region: "Delhi",   sort_order: 7 },
  // Their Chandigarh edition. Found on their own epaper site during migration,
  // where it was the one title nothing here matched.
  { slug: "chardikala-chandigarh", name: "Chardikala Chandigarh",     name_local: "ਚੜ੍ਹਦੀਕਲਾ ਚੰਡੀਗੜ੍ਹ", group_name: "ਚੜ੍ਹਦੀਕਲਾ", language: "pa", region: "Chandigarh", sort_order: 4 },
  // Punjabi, not English. Its PDF embeds Satluj, a Gurmukhi font, and the
  // masthead reads ਰੋਜ਼ਾਨਾ ਐਜੂਕੇਟਰ. Having it set to English made OCR read a
  // Gurmukhi page with the Latin model and find nothing worth indexing.
  { slug: "educater-delhi",     name: "Educater Delhi",               name_local: "ਰੋਜ਼ਾਨਾ ਐਜੂਕੇਟਰ", group_name: "ਹੋਰ",    language: "pa", region: "Delhi",   sort_order: 8 },
  { slug: "charhdikala-magazine", name: "Charhdikala Magazine",       name_local: "ਚੜ੍ਹਦੀਕਲਾ ਮੈਗਜ਼ੀਨ", group_name: "ਹੋਰ", language: "pa", region: null,      sort_order: 9 },
] as const;

const existing = new Set(listPublications(true).map((p) => p.slug));
let added = 0;
for (const p of PUBLICATIONS) {
  // Upsert, so a correction here reaches a database that was already seeded.
  upsertPublication({ ...p });
  if (!existing.has(p.slug)) added += 1;
}
console.log(
  `  publications: ${added} added, ${PUBLICATIONS.length - added} updated`,
);
for (const p of listPublications()) {
  console.log(`    ${p.sort_order}. ${p.slug.padEnd(24)} ${p.language}  ${p.name_local ?? p.name}`);
}
