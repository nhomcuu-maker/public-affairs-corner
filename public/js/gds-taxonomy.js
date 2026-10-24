/* One source of truth: exactly three domains and three visible categories each.
   Use metadata / assigned SQL category; never fill a category with unrelated search hits. */
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  if (root) root.GDSTaxonomy = value;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const sections = Object.freeze({
    LEGAL: Object.freeze([
      { id: 'lao-dong-viec-lam', title: 'Lao động và việc làm', sqlCodes: ['LAO_DONG'] },
      { id: 'dan-su-va-quyen-loi', title: 'Dân sự và quyền lợi', sqlCodes: ['DAN_SU'] },
      { id: 'dat-dai', title: 'Đất đai', sqlCodes: ['DAT_DAI'] }
    ]),
    ADMIN: Object.freeze([
      { id: 'dich-vu-cong-truc-tuyen', title: 'Dịch vụ công trực tuyến', sqlCodes: ['DICH_VU_CONG'] },
      { id: 'ho-chieu-va-ho-tich', title: 'Hộ chiếu và hộ tịch', sqlCodes: ['HO_CHIEU_HO_TICH'] },
      { id: 'cu-tru-va-giay-to-tuy-than', title: 'Cư trú và giấy tờ tùy thân', sqlCodes: ['CU_TRU_GIAY_TO'] }
    ]),
    SCAM: Object.freeze([
      { id: 'gia-danh-co-quan-to-chuc', title: 'Giả danh cơ quan, tổ chức', sqlCodes: ['GIA_DANH'] },
      { id: 'lien-ket-va-trang-web-gia-mao', title: 'Liên kết và trang web giả mạo', sqlCodes: ['LINK_GIA'] },
      { id: 'lua-dao-tuyen-dung-dau-tu', title: 'Lừa đảo tuyển dụng, đầu tư', sqlCodes: ['TUYEN_DUNG', 'DAU_TU'] }
    ])
  });
  const canonical = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  const aliases = Object.freeze({
    LEGAL: {'lao-dong':'lao-dong-viec-lam','dan-su':'dan-su-va-quyen-loi','dan-su-quyen-loi':'dan-su-va-quyen-loi'},
    ADMIN: {'ho-chieu-và-ho-tich':'ho-chieu-va-ho-tich','cu-tru':'cu-tru-va-giay-to-tuy-than'},
    SCAM: {'impersonation':'gia-danh-co-quan-to-chuc','phishing':'lien-ket-va-trang-web-gia-mao','jobs':'lua-dao-tuyen-dung-dau-tu','investments':'lua-dao-tuyen-dung-dau-tu'}
  });
  function matchDomain(domain){ return Object.prototype.hasOwnProperty.call(sections,domain) ? domain : 'LEGAL'; }
  function resolveId(domain, raw) {
    const id=String(raw||'');const domainKey=matchDomain(domain);
    const resolved=aliases[domainKey][id]||id;
    return sections[domainKey].some(c=>c.id===resolved)?resolved:null;
  }
  function sqlCategory(domain, code){
    const x=String(code||'').toUpperCase().trim();
    const category=sections[matchDomain(domain)].find(c=>c.sqlCodes.includes(x));
    return category ? category.id : null;
  }
  // Search narrowly over document title and independently curated topic label ONLY.
  // No body, excerpt or fulltext matching for assigning topics: legal documents cite
  // other unrelated laws and would otherwise leak between categories.
  function classifyReference(item) {
    const domain=String(item?.domain||'');
    if (domain!=='LEGAL' && domain!=='ADMIN') return null;
    const title=canonical(item.title), label=canonical(item.topic||'');
    if(domain==='LEGAL') {
      if (/^(luat|bo luat)\s+(viec lam|lao dong)\b/.test(title) || /^(lao dong va viec lam|viec lam va tro cap that nghiep)$/.test(label)) return 'lao-dong-viec-lam';
      if (/^(bo luat dan su|luat dan su)\b/.test(title) || /^(dan su va quyen loi|luat dan su)$/.test(label)) return 'dan-su-va-quyen-loi';
      if (/^(luat dat dai|van ban ve dat dai)\b/.test(title) || label==='dat dai') return 'dat-dai';
    } else {
      if (/\b(dich vu cong truc tuyen|cong dich vu cong|nop ho so truc tuyen|giai quyet truc tuyen)\b/.test(title) || label==='dich vu cong truc tuyen') return 'dich-vu-cong-truc-tuyen';
      if (/\b(ho chieu|ho tich|khai sinh|khai tu|dang ky ket hon)\b/.test(title) || label==='ho chieu va ho tich') return 'ho-chieu-va-ho-tich';
      if (/\b(cu tru|thuong tru|tam tru|can cuoc|giay to tuy than)\b/.test(title) || label==='cu tru va giay to tuy than') return 'cu-tru-va-giay-to-tuy-than';
    }
    return null;
  }
  function isRelatedReference(domain, category, item){
    return domain === item.domain && resolveId(domain,category)===classifyReference(item);
  }
  return { sections, canonical, matchDomain, resolveId, sqlCategory, classifyReference, isRelatedReference };
});
