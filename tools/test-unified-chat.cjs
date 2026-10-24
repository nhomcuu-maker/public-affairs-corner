const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');const read=s=>fs.readFileSync(path.join(root,s),'utf8');
const widget=read('public/js/gds-chat.js');new Function(widget);
assert(widget.includes("'/api/assistant/ask'"));
assert(widget.includes("'/api/admin/assistant/ask'"));
assert(widget.includes('GDSChat'));
assert(widget.includes("const domain='ALL'"));
assert(widget.includes('sourceUrl'));
assert(widget.includes("x.protocol==='https:'"));
assert(widget.includes('textContent'));
assert(!widget.includes('location.assign'));
assert(!widget.includes('localStorage'));
assert(!widget.includes('sessionStorage'));
for(const name of ['index','phap-luat-quyen-loi','thu-tuc-hanh-chinh','canh-bao-lua-dao','bieu-mau-bao-cao','tim-kiem-tri-thuc','bat-dau']){
 const html=read('public/'+name+'.html');
 assert(html.includes('/js/gds-chat.js')&&html.includes('/css/gds-chat.css'),name);
 assert(!html.includes('src="./js/gds-ai-topic-bridge.js"'),name);
 assert(!html.includes('src="./js/gds-ai-report-bridge.js"'),name);
 assert(!html.includes('src="./js/gds-ai-launcher.js"'),name);
 assert(!html.includes('id="chatModal"')&&!html.includes('id="aiChatModal"'),name);
}
const standalone=read('public/tro-ly-ai.html');assert(standalone.includes('id="gds-chat-host"'));
assert(!standalone.includes('gds-links')&&!standalone.includes('gds-evidence'));
console.log('UNIFIED CHAT STATIC: PASS (7 public pages, no redirect, compact answers, no persistent questions)');
